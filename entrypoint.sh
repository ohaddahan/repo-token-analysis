#!/bin/bash
set -euo pipefail

git config --global --add safe.directory "${GITHUB_WORKSPACE:-/github/workspace}"

node /app/dist/main.js
