import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./config.js";
import type { AggregateReport } from "./aggregate.js";
import type { DiagnosticsReport, TrendEntry } from "./diagnostics.js";
import type { BadgeOutput } from "./badges.js";

interface ArtifactsInput {
  config: Config;
  report: AggregateReport;
  diagnostics: DiagnosticsReport;
  badges: BadgeOutput[];
  code2promptRaw: string;
  repomixRaw: string;
}

export async function writeArtifacts(input: ArtifactsInput): Promise<void> {
  const { config, report, diagnostics, badges, code2promptRaw, repomixRaw } = input;
  const { output_dir, history_max_entries } = config;

  const badgesDir = join(output_dir, "badges");
  await mkdir(badgesDir, { recursive: true });

  await Promise.all([
    writeReport(output_dir, report, diagnostics),
    writeHistory(output_dir, report, history_max_entries),
    writeTree(output_dir, code2promptRaw),
    writeDependencies(output_dir, repomixRaw),
    writeBadges(badgesDir, badges),
  ]);
}

async function writeReport(
  outputDir: string,
  report: AggregateReport,
  diagnostics: DiagnosticsReport,
): Promise<void> {
  const full = { ...report, diagnostics };
  await writeFile(join(outputDir, "report.json"), JSON.stringify(full, null, 2), "utf-8");
}

async function writeHistory(
  outputDir: string,
  report: AggregateReport,
  maxEntries: number,
): Promise<void> {
  const historyPath = join(outputDir, "history.json");
  let history: TrendEntry[] = [];

  if (existsSync(historyPath)) {
    try {
      const raw = await readFile(historyPath, "utf-8");
      history = JSON.parse(raw) as TrendEntry[];
    } catch {
      history = [];
    }
  }

  history.push({
    timestamp: report.timestamp,
    tiktoken_total: report.tokenizers.tiktoken,
  });

  if (history.length > maxEntries) {
    history = history.slice(history.length - maxEntries);
  }

  await writeFile(historyPath, JSON.stringify(history, null, 2), "utf-8");
}

async function writeTree(outputDir: string, content: string): Promise<void> {
  await writeFile(join(outputDir, "tree.md"), content, "utf-8");
}

async function writeDependencies(outputDir: string, content: string): Promise<void> {
  await writeFile(join(outputDir, "dependencies.md"), content, "utf-8");
}

async function writeBadges(badgesDir: string, badges: BadgeOutput[]): Promise<void> {
  await Promise.all(
    badges.map((badge) =>
      writeFile(join(badgesDir, `${badge.model}.svg`), badge.svg, "utf-8"),
    ),
  );
}
