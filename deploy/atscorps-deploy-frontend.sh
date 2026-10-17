#!/bin/bash
# Root-owned frontend promotion helper for Ex-Serviceman Jobs.
#
# Installed once, manually, on the EC2 instance — see DEPLOYMENT.md §3.1 for
# the exact install/ownership steps and the one-time migration this depends
# on. Invoked by ec2-user through a single, no-argument sudoers rule:
#
#   ec2-user ALL=(root) NOPASSWD: /usr/local/sbin/atscorps-deploy-frontend
#
# Takes no arguments by design — every path below is a fixed literal, so
# there is nothing an invoking user could pass that changes what this
# script touches. This also means the sudoers rule has zero argument
# surface to get wrong.
#
# What this closes, and how:
#
#   TOCTOU between validating the staged build and promoting it (the gap a
#   plain sudoers rule around `mv`/`rm` can only narrow, never close, because
#   ec2-user still owns the staged directory until the moment of the
#   privileged mv): this script's FIRST actions move the staged build into
#   /var/www (confirmed not writable by ec2-user — see DEPLOYMENT.md §3.2,
#   so ec2-user can't rename or replace the entry out from under this
#   script) AND explicitly chown/chmod it to root (because `mv` alone
#   preserves ec2-user's existing ownership of the CONTENT, which would
#   otherwise still be directly writable by ec2-user with no sudo at all,
#   even sitting inside a root-owned directory). Validation happens only
#   after both, so by the time it runs, nothing ec2-user does — with or
#   without sudo — can change what is being validated.
#
#   The live path momentarily missing during a promotion: the only operation
#   that changes what is externally visible (what Nginx serves at
#   $LIVE) is the final `mv -T` of a symlink onto $LIVE — a single rename(2)
#   syscall. It either fully lands or doesn't happen at all; there is no
#   intermediate state where $LIVE resolves to nothing. Everything before
#   that (moving the candidate into root space, validating it, rotating it
#   into the free slot) never touches $LIVE and so can never put the
#   currently-serving release at risk, even if it fails outright.
set -euo pipefail

READY="/home/ec2-user/.deploy-staging/frontend-ready"
INCOMING="/var/www/.frontend-incoming"
SLOT_A="/var/www/.frontend-a"
SLOT_B="/var/www/.frontend-b"
LIVE="/var/www/exservicemanjobs"
TMP_LINK="/var/www/.frontend-live-tmp"

if [ "$#" -ne 0 ]; then
  echo "ERROR: this script takes no arguments" >&2
  exit 1
fi

if [ -e "$LIVE" ] && [ ! -L "$LIVE" ]; then
  echo "ERROR: $LIVE exists but is a real directory, not the symlink this script expects." >&2
  echo "Run the one-time migration in DEPLOYMENT.md §3.1 before using this script." >&2
  exit 1
fi

if [ ! -d "$READY" ] || [ -L "$READY" ]; then
  echo "ERROR: $READY is missing or not a plain directory — nothing staged to promote" >&2
  exit 1
fi

# Take ownership of the candidate before validating it — in two parts.
# Moving it into /var/www stops ec2-user from renaming/deleting the entry
# (that directory is root:root, not writable by ec2-user), but `mv`
# preserves the ORIGINAL owner of what's moved: without the chown/chmod
# below, $INCOMING would still be ec2-user-owned and ec2-user-writable
# content sitting inside a root-owned directory — ec2-user could still
# edit files inside it directly, no sudo required, both now and later
# once it's promoted to the live slot. The explicit chown/chmod is what
# actually closes that, not the move by itself.
rm -rf "$INCOMING"
mv "$READY" "$INCOMING"
chown -R root:root "$INCOMING"
chmod -R go-w "$INCOMING"

if [ ! -d "$INCOMING" ] || [ -L "$INCOMING" ]; then
  echo "ERROR: staged build is not a plain directory — refusing to promote" >&2
  exit 1
fi
if [ ! -f "$INCOMING/index.html" ]; then
  echo "ERROR: staged build is missing index.html — refusing to promote" >&2
  exit 1
fi
FILE_COUNT=$(find "$INCOMING" -type f | wc -l)
if [ "$FILE_COUNT" -lt 3 ]; then
  echo "ERROR: staged build has suspiciously few files ($FILE_COUNT) — refusing to promote" >&2
  exit 1
fi

# Compare inode identity, not the symlink's stored path text — a plain
# string comparison against a readlink result is not reliable if the
# target was ever created or read through a different (but equivalent)
# path alias, which silently picks the WRONG "free" slot: the one that is
# actually live. Inode identity has no such ambiguity.
CURRENT_INODE=""
if [ -e "$LIVE" ]; then
  CURRENT_INODE=$(stat -c %i "$LIVE" 2>/dev/null || true)
fi
SLOT_A_INODE=""
if [ -e "$SLOT_A" ]; then
  SLOT_A_INODE=$(stat -c %i "$SLOT_A" 2>/dev/null || true)
fi
if [ -n "$CURRENT_INODE" ] && [ "$CURRENT_INODE" = "$SLOT_A_INODE" ]; then
  FREE_SLOT="$SLOT_B"
else
  FREE_SLOT="$SLOT_A"
fi

rm -rf "$FREE_SLOT"
mv "$INCOMING" "$FREE_SLOT"

# The only step visible to Nginx. ln+mv -T is the standard atomic-symlink-
# swap pattern: build the new link under a throwaway name, then rename it
# over $LIVE in one syscall.
ln -sfn "$FREE_SLOT" "$TMP_LINK"
mv -T "$TMP_LINK" "$LIVE"

echo "Frontend promoted: $FILE_COUNT files now live via $LIVE -> $FREE_SLOT"
