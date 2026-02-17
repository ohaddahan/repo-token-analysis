#!/bin/bash
set -euo pipefail

FIXTURE=test/fixture-repo

# Clone small repo if not already present
if [ ! -d "$FIXTURE" ]; then
  git clone --depth 1 https://github.com/expressjs/express.git "$FIXTURE"
fi

# Build
npm run build

# Run against fixture
GITHUB_WORKSPACE="$(pwd)/$FIXTURE" DRY_RUN=1 node dist/main.js

# Verify outputs
echo "=== Checking outputs ==="
head -30 "$FIXTURE/repo-token-analysis/report.json"
ls -la "$FIXTURE/repo-token-analysis/badges/"
