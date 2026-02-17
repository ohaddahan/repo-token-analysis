import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { encodingForModel } from "js-tiktoken";

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export interface TiktokenResult {
  totalTokens: number;
  perFile: Map<string, number>;
}

export async function runTiktoken(
  workspace: string,
  files: string[],
): Promise<TiktokenResult> {
  const enc = encodingForModel("gpt-4o");
  const perFile = new Map<string, number>();
  let totalTokens = 0;

  for (const file of files) {
    try {
      const fullPath = join(workspace, file);
      const content = await readFile(fullPath, "utf-8");

      if (content.length > MAX_FILE_SIZE) {
        continue;
      }

      const tokens = enc.encode(content).length;
      perFile.set(file, tokens);
      totalTokens += tokens;
    } catch {
      // skip unreadable files (binary, permission issues)
    }
  }

  return { totalTokens, perFile };
}
