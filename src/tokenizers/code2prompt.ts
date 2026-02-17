import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface Code2PromptResult {
  totalTokens: number;
  rawOutput: string;
}

export async function runCode2Prompt(workspace: string): Promise<Code2PromptResult> {
  try {
    const { stdout } = await execFileAsync(
      "code2prompt",
      [workspace, "--output-format", "json", "--token-format", "raw", "--encoding=cl100k"],
      { maxBuffer: 50 * 1024 * 1024 },
    );

    const parsed = JSON.parse(stdout) as { token_count?: number; prompt?: string };
    const totalTokens = parsed.token_count ?? 0;
    const rawOutput = parsed.prompt ?? stdout;

    return { totalTokens, rawOutput };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`code2prompt failed: ${message}`);
    return { totalTokens: 0, rawOutput: `code2prompt error: ${message}` };
  }
}
