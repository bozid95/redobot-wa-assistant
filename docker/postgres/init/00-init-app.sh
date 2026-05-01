#!/bin/bash
set -euo pipefail

create_database() {
  local db_name="$1"

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    SELECT format('CREATE DATABASE %I', '${db_name}')
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_database WHERE datname = '${db_name}'
    )\gexec
EOSQL
}

create_database "${EVOLUTION_DB_NAME}"
create_database "${APP_DB_NAME}"
