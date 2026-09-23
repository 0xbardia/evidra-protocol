#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
backup_dir="${BACKUP_DIR:-/var/backups/evidra}"
install -d -m 0750 "$backup_dir"
umask 077
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_path="$backup_dir/evidra-${stamp}.dump"

pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$dump_path"
sha256sum "$dump_path" > "$dump_path.sha256"
printf 'backup=%s\n' "$dump_path"

