# Repo Token Analysis — How It Works

## What Is This?

Ever pasted your entire codebase into Claude or ChatGPT and hit the "too long" wall? This GitHub Action measures exactly how close you are to that wall — for every major AI model — on every commit.

It's like a gas gauge for your repo's AI-friendliness.

## The Big Picture

```
Your repo → [Filter files] → [3 tokenizers in parallel] → [Analysis] → [Badges + Report] → [Auto-commit]
                                    ↓          ↓         ↓
                               code2prompt  repomix   tiktoken
```

Three independent tokenizers count your tokens. Why three? Cross-validation. Each tool counts slightly differently (different handling of whitespace, comments, special tokens). The tiktoken count is the "reference" because it's the only one that gives per-file breakdowns.

## Architecture

### The Orchestrator Pattern

The heart is `src/main.ts` — a flat, linear flow inspired by Rust's "flow method" pattern:

```
loadConfig → bootstrap → filterFiles → [tokenize ×3] → aggregate → diagnose → badges → artifacts → commit → threshold
```

Each step is a single function call. No nesting, no branching. You can read the entire pipeline in 30 seconds.

### Module Map

| Module | Purpose | Key Detail |
|--------|---------|------------|
| `config.ts` | Load settings | Layered: defaults → YAML → env vars |
| `bootstrap.ts` | First-run setup | Creates `.tokenignore`, inserts README badges |
| `filter.ts` | File selection | Applies `.gitignore` + `.tokenignore` |
| `tokenizers/code2prompt.ts` | Token count #1 | Subprocess call, also produces tree output |
| `tokenizers/repomix.ts` | Token count #2 | Library call via `runCli` |
| `tokenizers/tiktoken.ts` | Token count #3 (reference) | Per-file breakdown, used for diagnostics |
| `aggregate.ts` | Combine results | Per-model percentage calculations |
| `diagnostics.ts` | Find problems | Top-N offenders, suggestions, trends |
| `badges.ts` | SVG generation | Green/yellow/red per model |
| `artifacts.ts` | Write output files | JSON report, history, tree, badges |
| `commit.ts` | Git operations | Auto-commit as `github-actions[bot]` |

### State Machine

```
TRIGGERED → BOOTSTRAP → FILTER → [CODE2PROMPT | REPOMIX | TIKTOKEN] → AGGREGATE → DIAGNOSE → GENERATE → COMMIT → THRESHOLD → PASS/FAIL
```

## Technology Choices

**TypeScript + ESM**: Modern Node.js module system. `"type": "module"` in package.json means all `.js` files are ES modules. `NodeNext` module resolution handles the `.js` extension requirement in imports.

**Docker Action**: Pre-built image on GHCR includes Rust toolchain (for code2prompt) and Node.js. Heavy upfront build cost (~2GB image) but instant startup for users.

**badge-maker**: The same library that powers shields.io. Generates static SVGs committed to the repo — no external service dependency.

**js-tiktoken**: JavaScript port of OpenAI's tiktoken. Uses `cl100k_base` encoding (same as GPT-4/GPT-4o). Fast enough for per-file counting.

## Lessons and Patterns

### The `[skip ci]` Pattern
The action commits files, which would trigger itself again. The commit message includes `[skip ci]` to break this infinite loop. Simple and battle-tested.

### Config Layering
Settings follow the 12-factor app pattern: defaults → file config → environment variables. Each layer overrides the previous. GitHub Actions passes inputs as `INPUT_*` env vars to Docker containers.

### Graceful Degradation
Each tokenizer catches its own errors and returns zeros instead of crashing. If code2prompt isn't installed or repomix fails, the action still completes with whatever data it has.

### The ignore Package
Uses the `ignore` npm package (same engine as `.gitignore`) to parse `.tokenignore`. This means all `.gitignore` syntax works: globs, negation (`!`), directory markers (`/`).

## Potential Pitfalls

1. **Docker image size**: The Rust toolchain adds ~1GB. A future optimization is downloading a pre-built `code2prompt` binary instead.
2. **Large repos**: tiktoken reads every file sequentially. Files >1MB are skipped. For 10k+ file repos, this could be slow.
3. **README badge insertion**: Uses a marker comment (`<!-- repo-token-analysis-badges -->`). If your README has unusual structure, it skips insertion rather than risking corruption.
4. **repomix API stability**: The `runCli` function can return `void` in some code paths. The code handles this with a null check.
