#!/usr/bin/env bash
set -euo pipefail
# Existing database and reviewed migrations only. Never push the full schema at startup.
# APPLY_REVIEWED_MIGRATIONS=true applies every reviewed migration listed in
# lib/db/migrations/ORDER, in that order, each in its own checksummed transaction.
# Already-applied migrations are verified by checksum and skipped.
if [[ "${APPLY_REVIEWED_MIGRATIONS:-false}" == "true" ]]; then
  while IFS= read -r version; do
    [[ -z "$version" || "$version" == \#* ]] && continue
    node lib/db/scripts/migrate-learner-support.mjs "$version"
  done < lib/db/migrations/ORDER
elif [[ "${APPLY_LEARNER_SUPPORT_MIGRATION:-false}" == "true" ]]; then
  node lib/db/scripts/migrate-learner-support.mjs
fi
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
