#!/usr/bin/env bash
set -euo pipefail

# Dedicated disposable native-demo server only. NEVER use this entrypoint on
# the established CABO Learning Hub pilot or a school database.
if [[ "${CABO_ENVIRONMENT:-}" != "testing" ||
      "${CABO_TEST_DATABASE_ISOLATED:-}" != "true" ||
      "${CABO_NATIVE_TEST_BOOTSTRAP:-}" != "true" ||
      -z "${DATABASE_URL:-}" ]]; then
  # A deliberately unconfigured preview is NOT a crashed application:
  # serve setup instructions at /, while all /api routes return HTTP 503.
  # Neither DB access nor test sign-in is possible in this state.
  echo "CABO isolated native demo is not connected. Serving setup-pending page."
  exec node scripts/native-preview-pending.mjs
fi
mode="$(node lib/db/scripts/native-test-db-guard.mjs check)"
if [[ "$mode" == "EMPTY" ]]; then
  echo "Bootstrapping schema on verified EMPTY native-demo database."
  pnpm --filter @workspace/db run push-force
  for migration in \
    20261021_learner_success_loop \
    20261021_material_reading \
    20261022_native_auth_codes \
    20261023_quiz_idempotency; do
    node lib/db/scripts/migrate-learner-support.mjs "$migration"
  done
  CABO_NATIVE_TEST_BOOTSTRAP_GRANTED=true node lib/db/scripts/native-test-db-guard.mjs mark
elif [[ "$mode" == "READY" ]]; then
  echo "Verified marked native-demo database. No schema push will be performed."
else
  echo "Database guard returned an unexpected result; refusing to start." >&2
  exit 1
fi
# The existing server can seed fictional, clearly marked demo records only.
exec bash scripts/render-start.sh
