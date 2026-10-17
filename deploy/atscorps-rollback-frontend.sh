#!/bin/bash
# Root-owned frontend rollback helper for Ex-Serviceman Jobs.
#
# Companion to atscorps-deploy-frontend.sh, invoked automatically by the
# workflow's post-deploy health check when the public site doesn't come
# back up after a promotion — see DEPLOYMENT.md §3.1 and §4. Installed the
# same way, with its own single, no-argument sudoers rule:
#
#   ec2-user ALL=(root) NOPASSWD: /usr/local/sbin/atscorps-rollback-frontend
#
# Takes no arguments. It only ever repoints the live symlink to whichever
# of the two fixed slots it is NOT currently pointing at — it never writes,
# deletes, or inspects release content, so there is nothing for an argument
# to parameterize in the first place.
set -euo pipefail

SLOT_A="/var/www/.frontend-a"
SLOT_B="/var/www/.frontend-b"
LIVE="/var/www/exservicemanjobs"
TMP_LINK="/var/www/.frontend-live-tmp"

if [ "$#" -ne 0 ]; then
  echo "ERROR: this script takes no arguments" >&2
  exit 1
fi

if [ ! -L "$LIVE" ]; then
  echo "ERROR: $LIVE is not a symlink — nothing this script knows how to roll back" >&2
  exit 1
fi

CURRENT_INODE=$(stat -c %i "$LIVE" 2>/dev/null || true)
SLOT_A_INODE=""
if [ -e "$SLOT_A" ]; then
  SLOT_A_INODE=$(stat -c %i "$SLOT_A" 2>/dev/null || true)
fi

if [ -n "$CURRENT_INODE" ] && [ "$CURRENT_INODE" = "$SLOT_A_INODE" ]; then
  TARGET="$SLOT_B"
else
  TARGET="$SLOT_A"
fi

if [ ! -d "$TARGET" ]; then
  echo "ERROR: rollback target $TARGET does not exist — there is no other release to roll back to" >&2
  exit 1
fi

# Same atomic-rename pattern as promotion. The slot currently live (the one
# that just failed its health check) is left exactly as-is for inspection —
# this script only ever moves the symlink, never touches slot content.
ln -sfn "$TARGET" "$TMP_LINK"
mv -T "$TMP_LINK" "$LIVE"

echo "Rolled back: $LIVE -> $TARGET"
