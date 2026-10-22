#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
node "$root/artifacts/training-platform/scripts/make-icons.mjs"
cp "$root/artifacts/training-platform/public/icons/cabo-1024.png" "$root/native/ios/Assets.xcassets/AppIcon.appiconset/cabo-1024.png"
echo "Generated CABO's 1024px iOS icon from the shared brand mark."
