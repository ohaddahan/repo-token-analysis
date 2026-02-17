#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <patch|minor|major|x.y.z>"
  exit 1
}

[[ $# -eq 1 ]] || usage

BUMP="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

npm version "$BUMP" --no-git-tag-version --prefix "$ROOT"

VERSION=$(node -p "require('$ROOT/package.json').version")

sed -i "s|image:.*|image: 'docker://ghcr.io/ohaddahan/repo-token-analysis:v${VERSION}'|" "$ROOT/action.yml"

echo "Bumped to ${VERSION}"
