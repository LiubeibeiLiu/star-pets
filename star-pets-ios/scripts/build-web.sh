#!/bin/bash
set -euo pipefail
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
shared_root="$ios_root/../star-pets-android"
test -f "$shared_root/ui/index.html" || { echo 'Keep star-pets-android next to star-pets-ios.' >&2; exit 2; }
command -v npm >/dev/null || { echo 'Install Node.js LTS (includes npm).' >&2; exit 2; }
cd "$shared_root"
npm ci
npm run typecheck
npm test
npm run build:web
npm run build:web:ios
python3 "$ios_root/scripts/verify-delivery.py" --update-web-manifest
