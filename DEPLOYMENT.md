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
│ • backend   │     │  4. Backend (only if server/ changed):     │
│   tests     │     │     stage → npm ci → preserve .env →       │
│   against a │     │     atomic swap → restart the service.     │
│   throwaway │     │  5. Curl the real public URLs and fail the │
│   Postgres  │     │     run if either is unhealthy.            │
│ • build     │     │                                            │
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

### 3.1 Scoped sudo rule

The existing manual deploy already uses `sudo` for the frontend rsync, which
means `/var/www/exservicemanjobs` is not owned by the deploy user — and
restarting a systemd unit always needs elevated privilege. The deploy user
needs exactly these three operations and nothing else.

Create `/etc/sudoers.d/atscorps-deploy` (via `sudo visudo -f
/etc/sudoers.d/atscorps-deploy`, which validates syntax before saving):

```
# Scoped for the CI/CD deploy user. Confirm these binary paths on your box
# first — `which rsync` / `which systemctl` — Amazon Linux defaults shown.
ec2-user ALL=(root) NOPASSWD: /usr/bin/rsync -a --delete /home/ec2-user/.deploy-staging/frontend-* /var/www/exservicemanjobs/
ec2-user ALL=(root) NOPASSWD: /usr/bin/mv /var/www/exservicemanjobs /var/www/exservicemanjobs.prev-*
ec2-user ALL=(root) NOPASSWD: /usr/bin/mv /home/ec2-user/.deploy-staging/frontend-* /var/www/exservicemanjobs
ec2-user ALL=(root) NOPASSWD: /usr/bin/systemctl restart atscorps.service
ec2-user ALL=(root) NOPASSWD: /usr/bin/systemctl is-active --quiet atscorps.service
ec2-user ALL=(root) NOPASSWD: /usr/bin/systemctl status atscorps.service --no-pager
```

This is **not** blanket passwordless sudo — each line is one exact command.
`sudoers` wildcard matching is literal-per-segment, so `frontend-*` matches
only paths starting with that literal prefix; it does not grant access to
arbitrary paths or arbitrary rsync/mv/systemctl invocations.

The backend swap (`server/` directory) is **not** in this list — it lives
under `/home/ec2-user/ATS_corps/server`, inside the deploy user's own home
directory, which they already own. No sudo is used or needed for it.

**Security implication:** anyone who can push to `main` (or trigger
`workflow_dispatch`) can, through this pipeline, cause these three root-level
operations to run. That is an inherent consequence of having a CI/CD
pipeline that deploys to production at all — restricting it further than
this would mean the pipeline could no longer actually deploy. The scope
above is the minimum that still lets it do its job.

### 3.2 Confirm `/var/www` and `/home/ec2-user` are on the same filesystem

The frontend promotion step uses `mv` to swap the new build into place. On a
single root volume — the normal case for an EC2 instance that doesn't have a
separate EBS volume mounted at `/var/www` — `mv` is a `rename(2)`: instant and
atomic, so there is no moment where Nginx could see a half-written directory.

Verify this on your instance:

```bash
df /var/www /home/ec2-user
```

If both lines show the same filesystem, the swap is genuinely atomic. If they
differ, `mv` across filesystems silently falls back to copy-then-delete,
which is slower and briefly non-atomic — the deploy still works, it just
loses that specific guarantee. If that's the case on your box and it matters
to you, say so and the promotion step can be changed to `rsync -a --delete`
instead, which is safe either way but never atomic.

### 3.3 Nothing else to pre-create

Staging directories (`~/.deploy-staging/frontend-<run>`,
`~/.deploy-staging/server-<run>`) are created by the workflow itself via
`mkdir -p` and are unique per run, so nothing needs to exist ahead of time.
They are **not** automatically cleaned up — old ones (and the
`.prev-<timestamp>` backups described below) will accumulate under
`/home/ec2-user/.deploy-staging/` and `/var/www/exservicemanjobs.prev-*` /
`/home/ec2-user/ATS_corps/server.prev-*`. Deleting old ones is a manual,
occasional chore — this pipeline deliberately never auto-deletes anything
outside the one live path it's managing.

---

## 4. Rollback

**This is manual. There is no automatic rollback.** Claiming otherwise
without having exercised a real failure-and-revert against the actual
instance would be a claim this document can't back up — so it doesn't make
it.

What the pipeline *does* give you: every promotion renames the outgoing
directory to `<path>.prev-<timestamp>` instead of deleting it. To revert:

**Frontend:**
```bash
ls -d /var/www/exservicemanjobs.prev-* | sort | tail -1   # find the most recent backup
sudo mv /var/www/exservicemanjobs /var/www/exservicemanjobs.broken
sudo mv /var/www/exservicemanjobs.prev-<timestamp> /var/www/exservicemanjobs
```

**Backend:**
```bash
ls -d /home/ec2-user/ATS_corps/server.prev-* | sort | tail -1
mv /home/ec2-user/ATS_corps/server /home/ec2-user/ATS_corps/server.broken
mv /home/ec2-user/ATS_corps/server.prev-<timestamp> /home/ec2-user/ATS_corps/server
sudo systemctl restart atscorps.service
```

Neither of these touches the database or `uploads/` (which lives at
`/home/ec2-user/ATS_corps/uploads/`, a sibling of `server/`, never inside the
path either promotion step operates on) or anything in S3. Schema changes
applied by `initDb()` on a restart are additive-only
(`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`) by the existing,
pre-established convention this pipeline doesn't change — rolling back the
code does not need to roll back the schema.

---

## 5. Enabling the workflow

1. Add the four secrets from §2.
2. Apply the sudoers rule from §3.1 (confirm the binary paths first).
3. Push to `main`, or run it manually: Actions tab → "Deploy to Production" →
   Run workflow.
4. Watch the `validate` job first — if it's red, nothing touches the server.

---

## 6. Known limitations

- **Brief downtime on a backend deploy.** `systemctl restart` on a
  single-instance systemd service means a short gap while the process
  restarts — this is inherent to the existing single-instance architecture,
  not something this pipeline introduces. A zero-downtime backend deploy
  would need a second instance behind a load balancer, which is outside this
  task's scope.
- **No automatic rollback** (§4) — by design, not by omission; see above.
- **Lint is informational, not blocking** — `npm run lint` currently reports
  a pre-existing baseline unrelated to this pipeline (156 issues at the time
  this was written). Making it a hard gate today would block every future
  deploy, including ones that fix none of what it's complaining about. It
  still runs and is visible in every build log.
- **`mv`-atomicity depends on filesystem layout** — see §3.2.
