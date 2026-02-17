# Repo Token Analysis

A GitHub Marketplace Action that analyzes your repository's token count against AI model context windows (Claude 200k, GPT-4 128k, Gemini 1M). Cross-validates with code2prompt, repomix, and tiktoken. Generates SVG badges, JSON reports, and diagnostics with trend analysis.

## Usage

```yaml
name: Token Analysis
on: [push]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: ohaddahan/repo-token-analysis@v1
        with:
          threshold_percent: 75
          top_n_offenders: 10
          history_max_entries: 100
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `threshold_percent` | Fail CI if any model exceeds this % of context window | `75` |
| `top_n_offenders` | Number of largest files to report | `10` |
| `history_max_entries` | Max entries in history.json | `100` |

## Configuration

Create `.repo-analysis.yml` in your repo root for advanced configuration:

```yaml
threshold_percent: 75
history_max_entries: 100
top_n_offenders: 10
models:
  claude:
    context_size: 200000
  gpt4:
    context_size: 128000
  gemini:
    context_size: 1000000
```

## Output

All artifacts are written to `./repo-token-analysis/`:

```
repo-token-analysis/
  badges/
    claude.svg
    gpt4.svg
    gemini.svg
  history.json
  report.json
  tree.md
  dependencies.md
  .tokenignore.default
```

## Badges

The action generates SVG badges showing context usage per model:

- **Green**: Under 60% of context
- **Yellow**: 60-75% of context
- **Red**: Over threshold (default 75%)

Reference them in your README:

```markdown
![Claude](./repo-token-analysis/badges/claude.svg)
![GPT-4](./repo-token-analysis/badges/gpt4.svg)
![Gemini](./repo-token-analysis/badges/gemini.svg)
```

## File Filtering

Create a `.tokenignore` file (same syntax as `.gitignore`) to exclude files from analysis. A default one is auto-generated on first run.

## How It Works

1. **Bootstrap**: Generates `.tokenignore` and badge section if missing
2. **Filter**: Walks repo applying `.gitignore` + `.tokenignore` exclusions
3. **Tokenize**: Runs three tokenizers in parallel (code2prompt, repomix, tiktoken)
4. **Aggregate**: Computes per-model context usage percentages
5. **Diagnose**: Identifies top offenders and suggests optimizations
6. **Generate**: Creates SVG badges and writes report artifacts
7. **Commit**: Auto-commits artifacts as `github-actions[bot]`
8. **Threshold**: Fails CI if any model exceeds the configured threshold

## License

MIT
