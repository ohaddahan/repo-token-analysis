import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./config.js";
import type { AggregateReport } from "./aggregate.js";

export interface FileOffender {
  file: string;
  tokens: number;
  percent_of_smallest_model: number;
}

export interface Suggestion {
  file: string;
  message: string;
}

export interface TrendEntry {
  timestamp: string;
  tiktoken_total: number;
}

export interface TrendAnalysis {
  previous_total: number | null;
  delta: number | null;
  delta_percent: number | null;
  fastest_growing: Array<{ file: string; growth: number }>;
}

export interface DiagnosticsReport {
  top_offenders: FileOffender[];
  suggestions: Suggestion[];
  trend: TrendAnalysis;
}

interface DiagnosticsInput {
  config: Config;
  report: AggregateReport;
  perFile: Map<string, number>;
}

const VENDOR_PATTERNS = [
  /vendor\//i,
  /third[_-]?party\//i,
  /node_modules\//i,
  /\.min\.(js|css)$/i,
  /generated\//i,
  /proto\/.*\.go$/i,
];

function isVendorLike(file: string): boolean {
  return VENDOR_PATTERNS.some((pattern) => pattern.test(file));
}

function findSmallestModelSize(report: AggregateReport): number {
  let smallest = Infinity;
  for (const model of report.models) {
    if (model.context_size < smallest) smallest = model.context_size;
  }
  return smallest === Infinity ? 128_000 : smallest;
}

function buildTopOffenders(
  perFile: Map<string, number>,
  topN: number,
  smallestModelSize: number,
): FileOffender[] {
  return [...perFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([file, tokens]) => ({
      file,
      tokens,
      percent_of_smallest_model:
        Math.round((tokens / smallestModelSize) * 100 * 100) / 100,
    }));
}

function buildSuggestions(
  perFile: Map<string, number>,
  smallestModelSize: number,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const budgetThreshold = smallestModelSize * 0.2;

  for (const [file, tokens] of perFile) {
    if (tokens > budgetThreshold) {
      suggestions.push({
        file,
        message: `Uses ${((tokens / smallestModelSize) * 100).toFixed(1)}% of smallest model budget — consider splitting`,
      });
    } else if (tokens > 5000) {
      suggestions.push({
        file,
        message: "Over 5000 tokens — consider extracting constants or configs",
      });
    }

    if (isVendorLike(file)) {
      suggestions.push({
        file,
        message: "Appears to be vendored/generated — add to .tokenignore",
      });
    }
  }

  return suggestions;
}

async function buildTrend(config: Config): Promise<TrendAnalysis> {
  const historyPath = join(config.output_dir, "history.json");

  if (!existsSync(historyPath)) {
    return { previous_total: null, delta: null, delta_percent: null, fastest_growing: [] };
  }

  try {
    const raw = await readFile(historyPath, "utf-8");
    const history = JSON.parse(raw) as TrendEntry[];

    if (history.length === 0) {
      return { previous_total: null, delta: null, delta_percent: null, fastest_growing: [] };
    }

    const previous = history[history.length - 1];
    if (!previous) {
      return { previous_total: null, delta: null, delta_percent: null, fastest_growing: [] };
    }

    const previousTotal = previous.tiktoken_total;

    return {
      previous_total: previousTotal,
      delta: null,
      delta_percent: null,
      fastest_growing: [],
    };
  } catch {
    return { previous_total: null, delta: null, delta_percent: null, fastest_growing: [] };
  }
}

export async function diagnose(input: DiagnosticsInput): Promise<DiagnosticsReport> {
  const { config, report, perFile } = input;
  const smallestModelSize = findSmallestModelSize(report);

  const top_offenders = buildTopOffenders(perFile, config.top_n_offenders, smallestModelSize);
  const suggestions = buildSuggestions(perFile, smallestModelSize);
  const trend = await buildTrend(config);

  if (trend.previous_total !== null) {
    trend.delta = report.tokenizers.tiktoken - trend.previous_total;
    trend.delta_percent =
      trend.previous_total > 0
        ? Math.round((trend.delta / trend.previous_total) * 100 * 100) / 100
        : null;
  }

  return { top_offenders, suggestions, trend };
}
