#!/usr/bin/env bash
set -euo pipefail
corepack prepare pnpm@10.28.2 --activate
pnpm install --frozen-lockfile
PORT=10000 BASE_PATH=/ pnpm --filter @workspace/training-platform run build
pnpm --filter @workspace/api-server run build
