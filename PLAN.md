# Repo Token Analysis — Spec v1

## Summary

A GitHub Marketplace Action that analyzes a repo's AI-friendliness by measuring its total
token count against model context windows (Claude 200k, GPT-4 128k, Gemini 1M+). Uses
code2prompt AND repomix for cross-validated token counting. Reports both numbers, generates
mapping files (tree + dependency graph), static SVG badges, top-N offender diagnostics with
trend analysis, and fails CI when a configurable threshold is exceeded. All artifacts live
in `./repo-token-analysis/` and are auto-committed by the GitHub Actions bot on every commit
to every branch. Shipped as a pre-built Docker image on GHCR, published to GitHub Marketplace.

---

## State Machine

```
                    ┌─────────────┐
                    │  TRIGGERED   │  (push to any branch)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  BOOTSTRAP   │  (first run? auto-gen .tokenignore + badge README section)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  FILTER      │  (apply .gitignore + .tokenignore exclusions)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │                         │
       ┌──────▼──────┐          ┌──────▼──────┐
       │  CODE2PROMPT │          │   REPOMIX    │   (parallel)
       │  tokenize    │          │   tokenize   │
       └──────┬──────┘          └──────┬──────┘
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────▼──────┐
                    │  AGGREGATE   │  (report both counts, generate maps, tree, dep graph)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  DIAGNOSE    │  (top-N offenders, suggestions, trend from history.json)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  GENERATE    │  (SVG badges, update history.json, mapping files)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  COMMIT      │  (github-actions[bot] commits ./repo-token-analysis/)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  THRESHOLD   │  (check against configurable % per model)
                    └──────┬──────┘
                           │
                  ┌────────┼────────┐
                  │                 │
           ┌──────▼──────┐  ┌──────▼──────┐
           │    PASS      │  │    FAIL      │
           │  (under %)   │  │  (over %)    │
           └─────────────┘  └─────────────┘
```

## Flow Chart

```
1. Trigger: any push to any branch
2. Bootstrap (first run only):
   a. Generate default .tokenignore (node_modules, target/, dist/, .git/, lock files, binaries)
   b. Insert badge section into README.md
   c. Commit bootstrap files
3. Collect file list:
   a. Walk repo, apply .gitignore exclusions
   b. Apply .tokenignore exclusions
   c. ./repo-token-analysis/ itself is in .tokenignore (breaks circular dependency)
4. Run tokenizers (parallel):
   a. code2prompt → token count + tree + summaries
   b. repomix → token count + dependency graph
   c. tiktoken (cl100k_base) → independent baseline count
5. Aggregate results:
   a. Report all counts side by side (code2prompt, repomix, tiktoken)
   b. Per-model breakdown: Claude (200k), GPT-4 (128k), Gemini (1M+)
   c. Calculate % of context used per model
6. Diagnostics:
   a. Top-N files by token count (with % of budget)
   b. Actionable suggestions (split large files, extract constants, etc.)
   c. Trend analysis: compare current vs last N runs from history.json
7. Generate artifacts:
   a. Static SVG badges (per-model pass/fail/warning)
   b. Append to history.json (rolling 100 entries)
   c. Tree map + dependency graph files
8. Commit: github-actions[bot] pushes ./repo-token-analysis/ to current branch
9. Threshold check:
   a. For each model: if token count > (context_size * configured_threshold%) → FAIL
   b. Configurable threshold (default: 75%)
```

---

## Detailed Spec

### 1. Token Counting

| Aspect | Decision |
|---|---|
| Unit of measurement | Entire repo (all non-excluded files summed) |
| Target models | Claude (200k), GPT-4 (128k), Gemini (1M+) |
| Tokenizers | code2prompt, repomix, tiktoken (cl100k_base) — all three |
| Cross-validation | Report all counts side by side, no averaging, no "official" pick |
| Threshold | Configurable %, default 75% of context window |
| Enforcement | CI fails if any model exceeds threshold |

### 2. File Filtering

| Aspect | Decision |
|---|---|
| Base exclusions | `.gitignore` rules |
| Custom exclusions | `.tokenignore` (same syntax as `.gitignore`) |
| First-run behavior | Auto-generate default `.tokenignore` with common patterns |
| Self-exclusion | `./repo-token-analysis/` listed in `.tokenignore` |

**Default `.tokenignore` contents:**
```
# Generated analysis output (prevents circular dependency)
repo-token-analysis/

# Dependencies & build artifacts
node_modules/
target/
dist/
build/
.next/
__pycache__/
*.pyc
vendor/

# Lock files
package-lock.json
yarn.lock
pnpm-lock.yaml
Cargo.lock
Gemfile.lock
poetry.lock
go.sum

# Binary & media files
*.png
*.jpg
*.jpeg
*.gif
*.ico
*.svg
*.woff
*.woff2
*.ttf
*.eot
*.mp3
*.mp4
*.zip
*.tar.gz
*.pdf

# IDE & OS
.idea/
.vscode/
.DS_Store
```

### 3. Mapping Files (V1)

| Artifact | Source | Notes |
|---|---|---|
| Tree + file summaries | Delegated to code2prompt/repomix | Whatever they output natively |
| Dependency graph | Delegated to code2prompt/repomix | Language support depends on tools |
| ARCHITECTURE.md | **Skipped for V1** | Too complex without LLM; revisit in V2 |

### 4. Output Structure

All generated artifacts live in `./repo-token-analysis/`:

```
repo-token-analysis/
  badges/
    claude.svg
    gpt4.svg
    gemini.svg
  history.json          # rolling 100 entries
  report.json           # latest full analysis result
  tree.md               # directory tree + summaries
  dependencies.md       # dependency graph
  .tokenignore.default  # reference copy of auto-generated defaults
```

### 5. Diagnostics

**Top-N Offenders:**
- List the N largest files by token count
- Show each file's % of total budget per model
- Sorted descending by token count

**Actionable Suggestions:**
- Files > 20% of budget → "Consider splitting this file"
- Single files > 5000 tokens → "Extract constants/configs"
- Generated/vendored files detected → "Add to .tokenignore"

**Trend Analysis:**
- Token count delta vs previous run
- Fastest-growing files over last 10 runs
- Badge color changes (green → yellow → red)

### 6. Badges

| Type | V1 Support |
|---|---|
| Static SVG | Yes — generated per model, committed to repo |
| Dynamic (shields.io) | No — deferred to V2 |

**Badge states:**
- Green: under 60% of context
- Yellow: 60-75% of context (approaching threshold)
- Red: over threshold (75% default)

**README integration:**
- On first run, auto-insert badge section at top of README.md
- Badges reference `./repo-token-analysis/badges/*.svg`

### 7. CI / GitHub Action

| Aspect | Decision |
|---|---|
| Action type | Docker action (pre-built image on GHCR) |
| Trigger | Every commit to every branch |
| Commit identity | `github-actions[bot]` |
| Commit style | Separate "analysis update" commits |
| Branch behavior | Commit artifacts to every branch |
| Failure mode | CI fails if threshold exceeded |

### 8. Configuration

Users configure via `.repo-analysis.yml` in repo root:

```yaml
# Threshold as percentage of context window (default: 75)
threshold_percent: 75

# History retention (default: 100)
history_max_entries: 100

# Top-N offenders to report (default: 10)
top_n_offenders: 10

# Models and their context sizes (tokens)
models:
  claude:
    context_size: 200000
  gpt4:
    context_size: 128000
  gemini:
    context_size: 1000000
```

### 9. Docker Image

**Base:** Node + Rust toolchain (for code2prompt)

**Pre-installed tools:**
- code2prompt (cargo install)
- repomix (npm install -g)
- tiktoken (Python pip or Node binding)
- Badge generation library (e.g., badge-maker npm)
- jq for JSON manipulation

**Published to:** GitHub Container Registry (ghcr.io)

### 10. Distribution

| Channel | Status |
|---|---|
| GitHub Marketplace | V1 — primary distribution |
| Direct repo reference | Also supported (`uses: owner/repo-token-analysis@v1`) |

### 11. Monorepo Support

Whole-repo-only for V1. Entire repo treated as single unit.
Per-package analysis deferred to V2.

---

## V2 Backlog

- ARCHITECTURE.md auto-generation (LLM-powered)
- Dynamic badges via shields.io + GitHub Pages endpoint
- Monorepo per-package analysis
- Per-model tokenizer accuracy (Claude tokenizer, GPT tokenizer, Gemini tokenizer)
- Configurable trigger (schedule, PR-only, manual)
- PR comment mode (report without committing)

---

## Unresolved Questions

1. **Exact Gemini context size**: Gemini 1.5 Pro has 1M, Gemini 2.0 Flash has 1M — which specific model/version should be the reference?
2. **code2prompt output format**: Need to verify what tree/summary format code2prompt produces natively — does it match our needs or need post-processing?
3. **repomix dependency graph**: Does repomix actually produce dependency graphs, or just token-counted file lists? Need to verify capabilities.
4. **Badge insertion safety**: Auto-editing README.md is risky if README has unusual structure. What's the fallback if parsing fails?
5. **tiktoken in Docker**: tiktoken has Python and Node bindings — which one for the Docker image? Node keeps the stack simpler (already need Node for repomix).
6. **Commit loop prevention**: The action commits files, which triggers the action again. Need `[skip ci]` in commit messages or path-based trigger filtering.
7. **Large repo performance**: For repos with 10k+ files, running three tokenizers may be slow. Should there be a timeout or file-count limit?
