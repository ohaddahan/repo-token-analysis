# CLAUDE.md

## Project Overview

GitHub Marketplace Docker Action: analyzes repo token count against AI model context windows (Claude 200k, GPT-4 128k, Gemini 1M). Uses code2prompt, repomix, and tiktoken for cross-validated counting. Generates SVG badges, JSON reports, diagnostics with trend analysis.

## Tech Stack

- TypeScript, ESM (`"type": "module"`), Node.js 20
- Docker action distributed via GHCR
- Dependencies: js-tiktoken, badge-maker, yaml, ignore, glob, repomix

## Build & Run

```bash
npm install
npm run build      # tsc → dist/
npm run lint       # tsc --noEmit
```

## Architecture

Linear orchestrator in `src/main.ts`:
```
loadConfig → bootstrap → filterFiles → [code2prompt | repomix | tiktoken] → aggregate → diagnose → badges → artifacts → commit → threshold
```

## Key Files

- `src/main.ts` — orchestrator (flat flow)
- `src/config.ts` — config loading (defaults → YAML → env vars)
- `src/tokenizers/` — three tokenizer implementations
- `src/aggregate.ts` — combine results, per-model percentages
- `src/diagnostics.ts` — top-N offenders, suggestions, trends
- `src/badges.ts` — SVG badge generation
- `src/artifacts.ts` — write report.json, history.json, etc.
- `src/commit.ts` — git commit+push as github-actions[bot]

## Local Testing

```bash
npm run build && bash test/run.sh
```

Sets `DRY_RUN=1` to skip git commit/push. Clones expressjs/express as fixture repo. Expects exit code 1 (threshold exceeded for express-sized repos).

## Conventions

- No `.free()` on js-tiktoken — it doesn't have one
- repomix `runCli` can return `void` — always null-check
- `ignore` package: call `ignore()` directly, not `ignore.default()`
- `[skip ci]` in commit messages to prevent infinite loops
- `DRY_RUN` env var skips git commit/push in `src/commit.ts`
- code2prompt CLI flags: `--output-format json --token-format raw` (not `--json --tokens`)

## Detailed explanation

See FOR_USER.md for full architecture walkthrough.
