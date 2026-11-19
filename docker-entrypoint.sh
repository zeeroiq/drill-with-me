#!/usr/bin/env bash
# ==============================================================================
# JavaDrill Container Entrypoint Script
# Handles conditional Litestream restore & replication on GCP Cloud Run
# or direct execution for local Docker / dev environments.
# ==============================================================================

set -euo pipefail

DB_PATH="${SQLITE_DB_PATH:-/data/app.db}"

if [ -n "${LITESTREAM_GCS_BUCKET:-}" ]; then
  echo "==> [Entrypoint] Production GCP Cloud Run detected."
  echo "==> [Entrypoint] Replicating to GCS bucket: ${LITESTREAM_GCS_BUCKET}"
  
  # Ensure target SQLite database directory exists
  mkdir -p "$(dirname "$DB_PATH")"

  # Restore the database from GCS replica if replica exists and DB does not exist
  echo "==> [Entrypoint] Checking and restoring SQLite database from replica if needed..."
  litestream restore -if-db-not-exists -if-replica-exists -config /etc/litestream.yml "$DB_PATH"

  # Run Litestream replication in foreground, supervising the application command
  echo "==> [Entrypoint] Launching application under Litestream replication: $*"
  exec litestream replicate -exec "$*" -config /etc/litestream.yml
else
  echo "==> [Entrypoint] Local/Dev mode (LITESTREAM_GCS_BUCKET unset). Starting application directly..."
  exec "$@"
fi
