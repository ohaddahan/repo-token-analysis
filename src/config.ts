import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export interface ModelConfig {
  context_size: number;
}

export interface Config {
  threshold_percent: number;
  history_max_entries: number;
  top_n_offenders: number;
  models: Record<string, ModelConfig>;
  workspace: string;
  output_dir: string;
}

const DEFAULT_MODELS: Record<string, ModelConfig> = {
  claude: { context_size: 200_000 },
  gpt4: { context_size: 128_000 },
  gemini: { context_size: 1_000_000 },
};

const DEFAULTS: Omit<Config, "workspace" | "output_dir"> = {
  threshold_percent: 75,
  history_max_entries: 100,
  top_n_offenders: 10,
  models: DEFAULT_MODELS,
};

interface YamlConfig {
  threshold_percent?: number;
  history_max_entries?: number;
  top_n_offenders?: number;
  models?: Record<string, { context_size?: number }>;
}

function parseYamlConfig(raw: YamlConfig): Partial<Omit<Config, "workspace" | "output_dir">> {
  const { threshold_percent, history_max_entries, top_n_offenders, models } = raw;
  const result: Partial<Omit<Config, "workspace" | "output_dir">> = {};

  if (threshold_percent !== undefined) result.threshold_percent = threshold_percent;
  if (history_max_entries !== undefined) result.history_max_entries = history_max_entries;
  if (top_n_offenders !== undefined) result.top_n_offenders = top_n_offenders;

  if (models) {
    const parsed: Record<string, ModelConfig> = {};
    for (const [name, cfg] of Object.entries(models)) {
      if (cfg.context_size !== undefined) {
        parsed[name] = { context_size: cfg.context_size };
      }
    }
    if (Object.keys(parsed).length > 0) {
      result.models = { ...DEFAULT_MODELS, ...parsed };
    }
  }

  return result;
}

function readEnvOverrides(): Partial<Pick<Config, "threshold_percent" | "top_n_offenders" | "history_max_entries">> {
  const result: Partial<Pick<Config, "threshold_percent" | "top_n_offenders" | "history_max_entries">> = {};

  const threshold = process.env["INPUT_THRESHOLD_PERCENT"];
  if (threshold) result.threshold_percent = Number(threshold);

  const topN = process.env["INPUT_TOP_N_OFFENDERS"];
  if (topN) result.top_n_offenders = Number(topN);

  const history = process.env["INPUT_HISTORY_MAX_ENTRIES"];
  if (history) result.history_max_entries = Number(history);

  return result;
}

export async function loadConfig(): Promise<Config> {
  const workspace = process.env["GITHUB_WORKSPACE"] ?? process.cwd();
  const output_dir = join(workspace, "repo-token-analysis");

  let yamlOverrides: Partial<Omit<Config, "workspace" | "output_dir">> = {};
  const yamlPath = join(workspace, ".repo-analysis.yml");
  if (existsSync(yamlPath)) {
    const content = await readFile(yamlPath, "utf-8");
    const raw = parseYaml(content) as YamlConfig | null;
    if (raw) {
      yamlOverrides = parseYamlConfig(raw);
    }
  }

  const envOverrides = readEnvOverrides();

  return {
    ...DEFAULTS,
    ...yamlOverrides,
    ...envOverrides,
    workspace,
    output_dir,
  };
}
