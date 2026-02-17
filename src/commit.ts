import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function commitArtifacts(workspace: string): Promise<void> {
  if (process.env.DRY_RUN) {
    console.log("dry run — skipping commit");
    return;
  }
  const opts = { cwd: workspace };

  await execFileAsync(
    "git",
    ["config", "user.name", "github-actions[bot]"],
    opts,
  );
  await execFileAsync(
    "git",
    ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"],
    opts,
  );

  await execFileAsync("git", ["add", "repo-token-analysis/"], opts);

  const { stdout: status } = await execFileAsync(
    "git",
    ["status", "--porcelain", "repo-token-analysis/"],
    opts,
  );

  if (status.trim().length === 0) {
    console.log("No changes to commit");
    return;
  }

  await execFileAsync(
    "git",
    ["commit", "-m", "chore: update token analysis [skip ci]"],
    opts,
  );

  await execFileAsync("git", ["push"], opts);
  console.log("Committed and pushed analysis artifacts");
}
