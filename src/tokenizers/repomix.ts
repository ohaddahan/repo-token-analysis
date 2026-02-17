import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface RepomixResult {
  totalTokens: number;
  rawOutput: string;
}

export async function runRepomix(workspace: string): Promise<RepomixResult> {
  try {
    const { runCli } = await import("repomix");

    const outputFile = join(tmpdir(), `repomix-output-${Date.now()}.md`);

    const result = await runCli([workspace], workspace, {
      output: outputFile,
      style: "markdown",
      quiet: true,
    } as Parameters<typeof runCli>[2]);

    if (!result) {
      return { totalTokens: 0, rawOutput: "repomix returned no result" };
    }

    const totalTokens = result.packResult.totalTokens ?? 0;

    let rawOutput = "";
    try {
      rawOutput = await readFile(outputFile, "utf-8");
    } catch {
      rawOutput = `Repomix processed ${result.packResult.totalFiles ?? 0} files`;
    }

    return { totalTokens, rawOutput };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`repomix failed: ${message}`);
    return { totalTokens: 0, rawOutput: `repomix error: ${message}` };
  }
}
