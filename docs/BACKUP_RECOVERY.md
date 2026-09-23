# Backup and Recovery

PostgreSQL stores a rebuildable projection, not canonical protocol truth.
Backups are still useful for fast search/API recovery and operational audit.

## Backup

The repository includes `deploy/backup-evidra.sh`. Run it from a restricted
operator context with `DATABASE_URL` set to the production connection and a
backup directory such as `/var/backups/evidra`:

```sh
sudo -u evidra env DATABASE_URL='postgresql:///evidra_prod?host=/var/run/postgresql' \
  BACKUP_DIR=/var/backups/evidra ./deploy/backup-evidra.sh
```

The script creates a mode-600 PostgreSQL custom-format dump and a SHA-256 sidecar.
It does not print the connection string or delete old backups. Rotate old
backups under an explicit retention policy.

## Restore into a disposable database

```sh
createdb -O evidra evidra_recovery
pg_restore --clean --if-exists --no-owner --dbname='postgresql:///evidra_recovery?host=/var/run/postgresql' /var/backups/evidra/<dump>.dump
```

For a projection rebuild instead of dump restore:

```sh
dropdb --if-exists evidra_recovery
createdb -O evidra evidra_recovery
DATABASE_URL='postgresql:///evidra_recovery?host=/var/run/postgresql' pnpm db:migrate
```

Start a one-off API/indexer with the recovery environment, run the bootstrap,
check `/api/v1/stats`, then compare representative fact, request, resolution,
policy, and template records with finalized chain reads.

Never run `dropdb` against `evidra_prod` as part of a drill. Use a disposable
database name explicitly.

## Recovery acceptance

- migrations complete from an empty database;
- indexer reaches `healthy`;
- no duplicate historical resolutions are created;
- chain-derived canonical/latest values match;
- API health and readiness return normally;
- a public Fact page renders after the projection is rebuilt.

The production clean-database bootstrap performed during Phase 3 rebuilt the
current frozen state successfully. It produced two indexed facts, three
requests, three resolutions, three policies, and two templates. The backup
script was also smoke-tested against `evidra_prod`; `pg_restore --list`
recognized the mode-600 custom-format dump.
