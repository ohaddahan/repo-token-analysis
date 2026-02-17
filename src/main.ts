import { loadConfig } from "./config.js";
import { bootstrap } from "./bootstrap.js";
import { filterFiles } from "./filter.js";
import { runCode2Prompt } from "./tokenizers/code2prompt.js";
import { runRepomix } from "./tokenizers/repomix.js";
import { runTiktoken } from "./tokenizers/tiktoken.js";
import { aggregate } from "./aggregate.js";
import { diagnose } from "./diagnostics.js";
import { generateBadges } from "./badges.js";
import { writeArtifacts } from "./artifacts.js";
import { commitArtifacts } from "./commit.js";

async function run(): Promise<void> {
  const config = await loadConfig();
  console.log(`Workspace: ${config.workspace}`);
  console.log(`Output dir: ${config.output_dir}`);
  console.log(`Threshold: ${config.threshold_percent}%`);

  await bootstrap(config);
  console.log("Bootstrap complete");

  const files = await filterFiles(config.workspace);
  console.log(`Found ${files.length} files after filtering`);

  const [code2prompt, repomix, tiktoken] = await Promise.all([
    runCode2Prompt(config.workspace),
    runRepomix(config.workspace),
    runTiktoken(config.workspace, files),
  ]);
  console.log(
    `Token counts — code2prompt: ${code2prompt.totalTokens}, repomix: ${repomix.totalTokens}, tiktoken: ${tiktoken.totalTokens}`,
  );

  const report = aggregate({ config, code2prompt, repomix, tiktoken });
  console.log("Aggregation complete");

  const diagnostics = await diagnose({ config, report, perFile: tiktoken.perFile });
  console.log(`Diagnostics: ${diagnostics.top_offenders.length} top offenders, ${diagnostics.suggestions.length} suggestions`);

  const badges = generateBadges(report);
  console.log(`Generated ${badges.length} badges`);

  await writeArtifacts({
    config,
    report,
    diagnostics,
    badges,
    code2promptRaw: code2prompt.rawOutput,
    repomixRaw: repomix.rawOutput,
  });
  console.log("Artifacts written");

  await commitArtifacts(config.workspace);
  console.log("Commit step complete");

  const failed = report.models.filter(
    (m) => m.percent_used > config.threshold_percent,
  );
  if (failed.length > 0) {
    console.error("\nThreshold exceeded:");
    for (const m of failed) {
      console.error(`  ${m.name}: ${m.percent_used}% > ${config.threshold_percent}%`);
    }
    process.exitCode = 1;
  } else {
    console.log("\nAll models within threshold");
  }
}

run().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
