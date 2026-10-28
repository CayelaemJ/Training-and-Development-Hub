#!/usr/bin/env bash
set -euo pipefail
# Existing database and reviewed migration only. Never push the full schema at startup.
if [[ "${APPLY_LEARNER_SUPPORT_MIGRATION:-false}" == "true" ]]; then
  node lib/db/scripts/migrate-learner-support.mjs
fi
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
