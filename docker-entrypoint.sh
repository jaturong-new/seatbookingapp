#!/bin/sh
set -e

DB_PATH="${SEAT_DB_PATH:-/data/seatbooking.db}"
DB_DIR=$(dirname "$DB_PATH")
# Resolved from the working directory (/app in the image) rather than hardcoded, so this script
# is testable outside a container.
SNAPSHOT="${SEAT_DB_SNAPSHOT:-$(pwd)/seed/seatbooking.db}"

# Checked before touching anything, so an unwritable mount reports the fix instead of failing
# later with a bare "permission denied". WAL writes seatbooking.db-wal / -shm next to the
# database, so the directory itself must be writable — not just the file.
mkdir -p "$DB_DIR" 2>/dev/null || true
if [ ! -d "$DB_DIR" ] || [ ! -w "$DB_DIR" ]; then
  echo "[entrypoint] ERROR: $DB_DIR is not writable by uid $(id -u)." >&2
  echo "[entrypoint]        Bind mount? Run on the host: chown -R 1001:1001 <host dir>" >&2
  echo "[entrypoint]        Also check the mount is not read-only (:ro)." >&2
  exit 1
fi

# Seed the volume on first run only. Never overwrite an existing database — that file is the live
# booking data and the copy bundled in the image is a build-time snapshot.
if [ ! -f "$DB_PATH" ]; then
  if [ -f "$SNAPSHOT" ]; then
    echo "[entrypoint] $DB_PATH not found — seeding from image snapshot $SNAPSHOT"
    cp "$SNAPSHOT" "$DB_PATH"
  else
    echo "[entrypoint] $DB_PATH not found and no snapshot bundled — schema.sql will create empty tables"
  fi
else
  echo "[entrypoint] using existing database at $DB_PATH"
fi

exec "$@"
