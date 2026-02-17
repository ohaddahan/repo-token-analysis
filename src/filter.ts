import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { glob } from "glob";
import ignore from "ignore";

export async function filterFiles(workspace: string): Promise<string[]> {
  const ig = ignore();

  const gitignorePath = join(workspace, ".gitignore");
  if (existsSync(gitignorePath)) {
    const content = await readFile(gitignorePath, "utf-8");
    ig.add(content);
  }

  const tokenignorePath = join(workspace, ".tokenignore");
  if (existsSync(tokenignorePath)) {
    const content = await readFile(tokenignorePath, "utf-8");
    ig.add(content);
  }

  const allFiles = await glob("**/*", {
    cwd: workspace,
    nodir: true,
    dot: false,
    absolute: false,
  });

  return ig.filter(allFiles);
}
