# Deployment — CI/CD Pipeline

How `.github/workflows/deploy.yml` ships `main` to the production EC2 instance,
what one-time setup it needs before its first run, and how to undo a bad
deploy by hand.

---

## 1. What the pipeline does

```
push to main
     │
     ▼
┌─────────────┐     ┌──────────────────────────────────────────┐
│  validate   │────▶│  deploy  (only on main, only if validate  │
│             │     │  passed)                                  │
│ • npm ci    │     │                                            │
│ • typecheck │     │  1. Download the artifact validate built  │
│   (fe + be) │     │     — never rebuilt here, so what ships   │
│ • lint      │     │     is exactly what was tested.            │
│   (logged,  │     │  2. SSH in, verify the host key.           │
│   not       │     │  3. Frontend: stage → verify → atomic swap │
│   blocking) │     │     into /var/www/exservicemanjobs.        │
│ • backend   │     │  4. Curl the real public frontend URL; on  │
│   tests     │     │     failure, auto-rollback the frontend    │
│   against a │     │     symlink and fail the run.               │
│   throwaway │     │  5. Backend (only if server/ changed):      │
│   Postgres  │     │     stage → npm ci → preserve .env →       │
│ • build     │     │     atomic swap → restart → health-check  │
│             │     │     → auto-rollback on failure.             │
│             │     │  6. Curl both public URLs again as a final │
│             │     │     end-to-end check; fail the run if       │
│             │     │     either is unhealthy.                    │
└─────────────┘     └──────────────────────────────────────────┘
```

Nothing deploys on a pull request or any branch other than `main`. A manual
run (`workflow_dispatch`) is available from the Actions tab and follows the
exact same path.

Only one deploy runs at a time (`concurrency: production-deploy`) — a second
push while one is in flight queues behind it rather than racing it.

---

## 2. Required GitHub secrets

Settings → Secrets and variables → Actions → New repository secret.

| Secret | What it is | How to get it |
|---|---|---|
| `EC2_HOST` | The instance's address | Whatever you currently SSH to (IP or DNS name) |
| `EC2_USER` | The SSH login user | e.g. `ec2-user` |
| `EC2_SSH_PRIVATE_KEY` | The **private** key matching a public key already in that user's `~/.ssh/authorized_keys` | Generate a deploy-only keypair — don't reuse a personal key — and append its `.pub` to `authorized_keys` on the box. Paste the private key's full contents, including the `BEGIN`/`END` lines. |
| `EC2_KNOWN_HOSTS` | The server's SSH host key, pre-verified | Run **once**, from a machine you already trust the box from: `ssh-keyscan -H <EC2_HOST>`. Paste the full output. This is what lets the workflow use `StrictHostKeyChecking=yes` instead of blindly trusting whatever answers on that IP. |

None of these are ever printed in a workflow log. The private key is written
to a file under `$RUNNER_TEMP` with `chmod 600`, used only via `ssh -i`, and
deleted unconditionally (`if: always()`) at the end of the deploy job.

---

## 3. One-time EC2 preparation

### 3.1 Root-owned deployment helper, and the sudo rule for it

The frontend promotion now runs through a single root-owned helper script,
[`deploy/atscorps-deploy-frontend.sh`](deploy/atscorps-deploy-frontend.sh),
rather than a sequence of generic `mv`/`rm` commands granted through
sudoers. This replaces the previous design (kept in git history, and
described for context in the "why not wildcards" note below) and closes
two things that design could only narrow:

1. **The gap between validating a staged build and promoting it.** Under
   the old design, `ec2-user` still owned the staged directory at the
   moment the privileged `mv` acted on it — the unprivileged check and the
   privileged action were adjacent, not atomic, so a concurrent compromise
   of `ec2-user` could in theory swap the content in between. The helper's
   *first* actions move the staged candidate into `/var/www` (confirmed
   not writable by `ec2-user` — §3.2, so `ec2-user` can't rename or
   replace that directory entry) **and** explicitly `chown`/`chmod` it to
   root — `mv` alone preserves whoever already owned the content, which on
   its own would leave it still directly editable by `ec2-user` with no
   `sudo` at all, just sitting inside a root-owned parent. Validation
   happens only after both steps, so by the time it runs, nothing
   `ec2-user` does — with or without `sudo` — can change what's being
   validated.
2. **The live path being briefly missing during a swap.** A fixed
   literal-directory design can only ever update `/var/www/exservicemanjobs`
   via at least two renames (move the old release out, move the new one
   in), and there is an inherent window between them where the path
   resolves to nothing. The helper instead keeps `/var/www/exservicemanjobs`
   as a **symlink** that rotates between two fixed, root-owned content
   slots (`/var/www/.frontend-a`, `/var/www/.frontend-b`). The only
   operation that changes what's externally visible is a single `mv -T`
   that renames a new symlink over the old one — one `rename(2)` syscall,
   which is atomic on POSIX filesystems. There is no intermediate state.

**Install steps (one-time, not performed by this change):**

```bash
sudo install -o root -g root -m 0700 deploy/atscorps-deploy-frontend.sh \
  /usr/local/sbin/atscorps-deploy-frontend
sudo install -o root -g root -m 0700 deploy/atscorps-rollback-frontend.sh \
  /usr/local/sbin/atscorps-rollback-frontend
```

Mode `0700` owned by `root:root` means only root can read, write, or
execute either script — `ec2-user` cannot modify what root is about to run
as root, which matters: if `ec2-user` could edit it, the sudo rule below
would hand them arbitrary root execution regardless of what the script
currently says.

The second script, `atscorps-rollback-frontend.sh`, is invoked
automatically by the workflow's "Verify frontend health" step (§1, §4) if
the public site doesn't come back up after a promotion. It takes no
arguments and only ever repoints the live symlink to whichever slot isn't
currently live — it never writes or deletes release content, so the
failed release stays exactly where it was for inspection.

**One-time migration**, converting the existing live directory into the
slot+symlink layout this script expects (do this once, deliberately, not
as part of a routine deploy — there is a small, non-atomic window between
the two commands below, acceptable for a planned one-time cutover, not for
every future deploy):

```bash
sudo mv /var/www/exservicemanjobs /var/www/.frontend-a
sudo chown -R root:root /var/www/.frontend-a
sudo chmod -R go-w /var/www/.frontend-a
sudo ln -s /var/www/.frontend-a /var/www/exservicemanjobs
```

**The `chown`/`chmod` lines are not optional.** `mv` alone preserves
whoever already owns the existing live directory — on this box, confirmed
via `ls -ld`, that's `ec2-user:ec2-user`. Without explicitly re-owning it,
`.frontend-a` would sit inside root-owned `/var/www` (so `ec2-user` can't
rename or delete the entry) while its *contents* stayed directly editable
by `ec2-user` with no `sudo` at all — the helper script takes care of this
for every slot it populates from here on (it `chown`s the incoming build
before validating it), but the *first* slot, created by this one-time
migration, needs it done by hand once, here.

After this, `/var/www/exservicemanjobs` is a symlink, not a real directory
— Nginx's `root`/`alias` directive resolves it exactly as before (standard
symlink-following, not something that requires an nginx.conf change) —
**provided the real config doesn't set `disable_symlinks` on that path.**
No `nginx.conf` file exists in this repository, so this can't be checked
from the code alone — read-only inspection against the real instance
(`nginx -T 2>&1 | grep -i disable_symlinks`) has been run and returned no
output, confirming the assumption holds. Re-run it yourself before
migrating if you want to double-check:

```bash
nginx -T 2>/dev/null | grep -i disable_symlinks   # expect no output
```

**Sudoers rule** — create `/etc/sudoers.d/atscorps-deploy` (via `sudo
visudo -f /etc/sudoers.d/atscorps-deploy`):

```
# Scoped for the CI/CD deploy user. Confirm /usr/bin/systemctl on your box
# first — `which systemctl`. No argument on any line below varies with
# ec2-user's input: both helpers take none, and the systemctl lines are
# complete literals.
ec2-user ALL=(root) NOPASSWD: /usr/local/sbin/atscorps-deploy-frontend
ec2-user ALL=(root) NOPASSWD: /usr/local/sbin/atscorps-rollback-frontend
ec2-user ALL=(root) NOPASSWD: /usr/bin/systemctl restart atscorps.service
ec2-user ALL=(root) NOPASSWD: /usr/bin/systemctl is-active --quiet atscorps.service
ec2-user ALL=(root) NOPASSWD: /usr/bin/systemctl status atscorps.service --no-pager
```

This is a smaller sudo surface than the previous four-line `mv`/`rm`
design, not a larger one: `ec2-user` can trigger exactly two fixed
programs, each with zero arguments, plus the same three unchanged
`systemctl` lines used for the backend. There is nothing for `ec2-user` to
pass that changes what runs — the entire trust surface is "read these two
files once, and trust what they say," which is easier to audit than
reconstructing the same guarantees from generic coreutils invocations and
sudoers glob semantics.

**This list matches `deploy.yml` exactly** — every `sudo` invocation in the
"Deploy frontend", "Verify frontend health", and "Deploy backend" steps is
one of these five lines, and every line here corresponds to at least one
actual invocation; there is no line granted "for completeness" that the
workflow doesn't use.

**Why the previous design used no wildcards, for context.** An earlier
draft used `/var/www/exservicemanjobs.prev-*` to allow a growing history of
timestamped backups. `sudoers` matches command arguments with `fnmatch()`
**without** `FNM_PATHNAME`, meaning a trailing `*` matches `/` and `..`
sequences, not just "the rest of a filename" — and sudo does not
canonicalize the argument before matching. That rule would have permitted,
as a literal string match, something like `sudo mv /var/www/exservicemanjobs
/var/www/exservicemanjobs.prev-../../etc/cron.d/evil`. The fix at the time
was to make every `mv`/`rm` argument a complete literal with zero glob
characters. The helper script approach supersedes that fix rather than
depending on it: there are no `mv`/`rm` arguments in the sudoers file at
all anymore for the frontend, so the glob question doesn't arise.

**Symlinks.** The helper explicitly refuses to touch `$LIVE` if it exists
but is *not* already the symlink it expects (see the script), which is
what makes the one-time migration above a prerequisite rather than
something the script does automatically. This protection, like the
previous design's, depends on `/var/www` not being writable by `ec2-user`
— see §3.2.

The backend swap (`server/` directory) does **not** go through this
helper — it lives under `/home/ec2-user/ATS_corps/server`, inside the
deploy user's own home directory, which they already own, so there is no
privilege boundary to cross there. It uses the same symlink-rotation idea
(§3.1.1) but entirely unprivileged; only the `systemctl` lines above are
sudo'd for it.

**Security implication:** anyone who can push to `main` (or trigger
`workflow_dispatch`) can, through this pipeline, cause the helper and the
systemctl restarts to run as root. That is an inherent consequence of
having a CI/CD pipeline that deploys to production at all. With the
design above, the sudo surface cannot be used to execute arbitrary
commands, read files outside what the helper touches, or write new
root-owned content beyond rotating the two fixed frontend slots — the risk
is "can cause whatever `ec2-user` staged at `frontend-ready` to become the
live site," which is the one thing this pipeline exists to do.

### 3.1.1 Backend: the same atomic-pointer idea, no root helper needed

The backend promotion script (in `deploy.yml`'s "Deploy backend" step)
applies the identical idea — `/home/ec2-user/ATS_corps/server` is a
symlink rotating between `server-a` / `server-b` — for the same reason:
a plain-directory swap needs two renames with a window between them, a
symlink swap needs exactly one. Since `ec2-user` already owns this whole
tree, no root helper is needed; the script does the slot rotation directly.

This requires the same kind of one-time migration, unprivileged this time:

```bash
mv /home/ec2-user/ATS_corps/server /home/ec2-user/ATS_corps/server-a
ln -s /home/ec2-user/ATS_corps/server-a /home/ec2-user/ATS_corps/server
```

**This assumes the real `atscorps.service` systemd unit's
`WorkingDirectory=` is the literal path `/home/ec2-user/ATS_corps/server`,
with no hardening directive restricting symlink traversal.** No
`.service` file exists in this repository to check from the code alone,
but read-only inspection of the real unit has confirmed it:

```ini
[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/ATS_corps/server
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
```

`WorkingDirectory=` matches exactly, `ExecStart=/usr/bin/npm start`
matches `server/package.json`'s `"start": "tsx src/index.ts"` (and `tsx`
is a production `dependencies` entry there, not `devDependencies` — it
survives `npm ci --omit=dev`, so `npm start` won't fail looking for it),
and there is no `ProtectSystem=`, `ReadWritePaths=`, or `ReadOnlyPaths=`
present to restrict following a symlink. Re-run this yourself before
migrating if you want to double-check:

```bash
systemctl cat atscorps.service | grep -E 'WorkingDirectory|ProtectSystem|ReadWritePaths|ReadOnlyPaths'
```

If hardening is ever added later and scoped narrowly to the literal
`server` path, the symlink would need to be added to an allow-list
directive, which **is** a unit-file change requiring the explicit
approval this document's constraints call for.

### 3.2 Confirm `/var/www` is not writable by `ec2-user`

Everything in §3.1 — the symlink-safety argument in particular — rests on
`/var/www` itself being owned by root (or another system account) and not
writable by the deploy user. Read-only inspection of the real instance has
confirmed this:

```bash
ls -ld /var/www /var/www/exservicemanjobs
```

Result: `/var/www` is `root:root`, mode `755` — `ec2-user` is neither the
owner nor in the owning group, and there's no world-write bit, so the
assumption holds and §3.1 applies as written. `/var/www/exservicemanjobs`
itself (the directory the migration in §3.1 is about to move) is currently
`ec2-user:ec2-user` — expected, and exactly why that migration's explicit
`chown`/`chmod` step matters: the directory entry's parent being
root-protected doesn't by itself make the directory's own contents
root-owned.

### 3.3 Filesystem layout for the slots and staging

Two things are each now confined to one filesystem's worth of renames.
Read-only inspection has confirmed both are on the same device
(`/dev/nvme0n1p1`):

```bash
df /var/www
df /home/ec2-user
```

The frontend helper's `mv "$INCOMING" "$FREE_SLOT"` and the `ln`+`mv -T`
symlink swap both happen entirely within `/var/www`, and the backend
script's equivalent operations happen entirely within
`/home/ec2-user/ATS_corps` — neither crosses a filesystem boundary by
construction, since each slot and its live symlink live side by side in the
same directory. This matters more than it used to: `mv` across filesystems
silently falls back to copy-then-delete, which is **not atomic** — and the
one truly atomic operation this design depends on (the final symlink
rename) would lose that guarantee if `/var/www/.frontend-a`,
`/var/www/.frontend-b`, and `/var/www/exservicemanjobs` were ever split
across separate mounts. Don't do that; there's no reason to, and nothing
here checks for it at deploy time.

### 3.4 Nothing else to pre-create

Staging directories (`~/.deploy-staging/frontend-<run-id>`,
`~/.deploy-staging/server-<run-id>`) are created by the workflow itself via
`mkdir -p` and are unique per run, so nothing needs to exist ahead of time
beyond the one-time migrations in §3.1 / §3.1.1.

Both frontend and backend are now bounded two-slot designs — at any time,
exactly `.frontend-a` and `.frontend-b` (or `server-a` / `server-b`) exist,
one live and one previous, never a growing history. Nothing accumulates
under `/var/www` or `/home/ec2-user/ATS_corps` across ordinary deploys. The
one exception: if a backend health check fails, the broken release is left
in whichever slot it occupied rather than deleted (see §4) — a slot sitting
unreferenced-by-the-symlink after an incident is a sign to go look at it,
not itself a problem, but it won't clean itself up. Run-unique staging dirs
under `~/.deploy-staging/` that never reached promotion (e.g. the job was
cancelled mid-run) are also not auto-deleted; clearing those out is a
manual, occasional chore.

---

## 4. Rollback

**The live-pointer swap itself is atomic and can't leave the site down
mid-promotion. Rollback on a detected failure is automatic for both
frontend and backend, including a failed post-deploy health check.
Neither claim extends to a mid-script interruption** — this section says
exactly what is and isn't covered, rather than more than has actually been
exercised.

**Frontend** (`deploy/atscorps-deploy-frontend.sh`, invoked via sudo): the
staged build is validated only *after* being moved into root-owned space,
then rotated into whichever of `.frontend-a` / `.frontend-b` isn't
currently live, then the live symlink is repointed to it with one `mv -T`.
Everything before that final rename only ever touches the free slot — never
`$LIVE` — so a failure at any point before it (a failed validation, a
failed `mv` into the free slot) leaves the currently-serving release
completely untouched. The symlink rename itself either fully lands or
doesn't happen; there's no partial state for the script itself to recover
from.

After promotion, the workflow's "Verify frontend health" step (§1, §5)
curls the real public URL with retries. If it never returns 200, the
workflow SSHes back in and runs `atscorps-rollback-frontend.sh` — a second
root-owned, zero-argument helper whose only job is to repoint the live
symlink to whichever slot it is *not* currently pointing at. It then
re-checks the public URL once more to confirm the rollback actually
restored a working site, and the job fails either way (via `exit 1`) so a
bad deploy is never silently left either "live and broken" or "rolled back
but unreported." The slot that failed its health check is never deleted —
only the symlink moves — so it stays on disk for inspection, the same way
the backend's `.failed`-equivalent slot does.

**A 200 response is not a claim that the site works** — it confirms the
page loads, nothing about any specific feature behind it.

**Backend** (`deploy.yml`'s "Deploy backend" step, unprivileged file ops):
same rotate-then-repoint shape. After the repoint, `systemctl restart` runs
and `is-active` is checked. If the service doesn't come up, the script
repoints the symlink straight back to the previous slot (still fully intact
— it was never touched), restarts, and re-verifies `is-active` before
declaring the rollback itself successful. The broken build stays on disk in
whichever slot it was promoted into, for inspection, rather than being
deleted.

**What this does not cover:**
- **Mid-script interruption** (the SSH connection drops partway through).
  Everything up to and including the symlink rename either completes or
  doesn't — but if the connection drops *after* the rename and *before* the
  step that follows it (the frontend health check; the backend's
  `systemctl restart`), that follow-up step simply never runs in this job.
  **Recovery:** re-run the workflow (`workflow_dispatch`), or by hand —
  for the frontend, the live symlink already points at the new content;
  just confirm it's actually serving correctly (§5) and, if not, use the
  manual revert below. For the backend, the OLD process keeps running
  against the OLD code it already loaded, with the symlink now pointing at
  the NEW code on disk — SSH in and run `sudo systemctl restart
  atscorps.service` by hand to pick it up, then check `sudo systemctl
  is-active atscorps.service`. Nothing is missing or corrupted in this
  window, just temporarily inconsistent between "what's on disk" and
  "what's running."
- **The one-time migration's own small window** (§3.1, §3.1.1) — moving the
  existing live directory into its first slot and creating the symlink is
  two commands, briefly non-atomic, acceptable for a planned one-time
  cutover and not repeated on every deploy.
- **None of this has been exercised against the real EC2 instance** — only
  against a mocked/sandboxed test harness (see this change's final report
  for exactly what was and wasn't covered, including a real limitation:
  the slot-rotation logic's inode comparison could not be fully validated
  end-to-end in the Windows development sandbox used to write this, due to
  how that sandbox emulates POSIX symlinks — standard on the real Linux
  target, but worth a cheap smoke test after the real migration: deploy
  twice in a row and confirm the live symlink actually alternates between
  `.frontend-a` and `.frontend-b`).

**Manual revert**, if needed — the automatic rollback above (§4, frontend)
already handles an outright failed health check; this is for a bad deploy
that returns 200 but is wrong in some way the health check doesn't catch:

**Frontend:**
```bash
readlink /var/www/exservicemanjobs                     # which slot is live now
sudo /usr/local/sbin/atscorps-rollback-frontend         # flips to the other slot
```
This runs the exact same rollback the health check triggers automatically
— safe to run by hand any time you've spotted a bad deploy that the
automatic check didn't catch.

**Backend:**
```bash
readlink /home/ec2-user/ATS_corps/server
ln -sfn /home/ec2-user/ATS_corps/server-a /home/ec2-user/ATS_corps/server   # or server-b
sudo systemctl restart atscorps.service
```

None of the above touches the database or `uploads/` (which lives at
`/home/ec2-user/ATS_corps/uploads/`, a sibling of `server/`, never inside
the path either promotion step operates on) or anything in S3, and none of
it runs any destructive migration. Schema changes applied by `initDb()` on
a restart are additive-only (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF
NOT EXISTS`) by the existing, pre-established convention this pipeline
doesn't change — rolling back the code does not need to roll back the
schema.

---

## 5. Enabling the workflow

1. Add the four secrets from §2.
2. Install both frontend helper scripts and apply the sudoers rule from
   §3.1.
3. Run the one-time migrations from §3.1 (frontend) and §3.1.1 (backend),
   checking the Nginx and systemd prerequisites noted there first.
4. Push to `main`, or run it manually: Actions tab → "Deploy to Production" →
   Run workflow.
5. Watch the `validate` job first — if it's red, nothing touches the server.

---

## 6. Known limitations

- **Brief downtime on a backend deploy.** `systemctl restart` on a
  single-instance systemd service means a short gap while the process
  restarts — this is inherent to the existing single-instance architecture,
  not something this pipeline introduces. A zero-downtime backend deploy
  would need a second instance behind a load balancer, which is outside this
  task's scope.
- **The frontend health check only confirms the page loads (HTTP 200)**
  (§4, §5) — it is not a claim that any specific feature works. A
  validated-and-promoted build that is logically broken in a way that
  still returns 200 (wrong API URL baked in, say) will pass this check,
  go live, and stay live until the next deploy or a manual revert.
- **Mid-script interruption right after a symlink rename, before the next
  step runs** (§4) — an SSH drop between the backend's symlink rename and
  its `systemctl restart`, or between the frontend's rename and the
  workflow's health check, leaves that follow-up step simply not run in
  that job. Nothing is missing or corrupted; §4 gives the manual recovery
  command for each case.
- **The one-time migrations themselves have a small, non-atomic window**
  (§3.1, §3.1.1) — acceptable for a single planned cutover, not something
  that happens on every deploy.
- **Nginx's and systemd's behavior with the new symlink-based paths has
  been checked read-only, not yet exercised live** — no `nginx.conf` or
  `atscorps.service` unit file exists in this repository, so `disable_symlinks`,
  `WorkingDirectory=`, and hardening like `ProtectSystem=`/`ReadWritePaths=`
  couldn't be checked from the code; read-only inspection of the real
  instance (§3.1, §3.1.1) found no `disable_symlinks` and no restrictive
  hardening on the unit. That confirms the assumption holds on paper — it
  does not substitute for actually running a deploy through the real
  symlink-based paths once, which hasn't happened yet.
- **Lint is informational, not blocking** — `npm run lint` currently reports
  a pre-existing baseline unrelated to this pipeline (156 issues at the time
  this was written). Making it a hard gate today would block every future
  deploy, including ones that fix none of what it's complaining about. It
  still runs and is visible in every build log.
- **`mv`-atomicity for populating a free slot depends on filesystem
  layout** — see §3.3. The final symlink rename is atomic regardless, as
  long as the symlink and both slots stay on the same filesystem.
- **The frontend slot-rotation logic's real-environment behavior was not
  fully exercised end-to-end** — see this change's report for specifics;
  verify with two consecutive real deploys after migration (§4).
