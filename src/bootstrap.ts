import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./config.js";

const DEFAULT_TOKENIGNORE = `# Generated analysis output (prevents circular dependency)
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
`;

const BADGE_MARKER = "<!-- repo-token-analysis-badges -->";

function buildBadgeSection(): string {
  return `${BADGE_MARKER}
![Claude](./repo-token-analysis/badges/claude.svg)
![GPT-4](./repo-token-analysis/badges/gpt4.svg)
![Gemini](./repo-token-analysis/badges/gemini.svg)
${BADGE_MARKER}

`;
}

export async function bootstrap(config: Config): Promise<void> {
  const { workspace, output_dir } = config;

  await ensureTokenIgnore(workspace, output_dir);
  await ensureReadmeBadges(workspace);
}

async function ensureTokenIgnore(workspace: string, outputDir: string): Promise<void> {
  const tokenIgnorePath = join(workspace, ".tokenignore");
  if (!existsSync(tokenIgnorePath)) {
    await writeFile(tokenIgnorePath, DEFAULT_TOKENIGNORE, "utf-8");
  }

  const defaultCopyPath = join(outputDir, ".tokenignore.default");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(outputDir, { recursive: true });
  await writeFile(defaultCopyPath, DEFAULT_TOKENIGNORE, "utf-8");
}

async function ensureReadmeBadges(workspace: string): Promise<void> {
  const readmePath = join(workspace, "README.md");
  if (!existsSync(readmePath)) return;

  const content = await readFile(readmePath, "utf-8");
  if (content.includes(BADGE_MARKER)) return;

  const updated = buildBadgeSection() + content;
  await writeFile(readmePath, updated, "utf-8");
}
