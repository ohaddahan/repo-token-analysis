import type { Config, ModelConfig } from "./config.js";
import type { Code2PromptResult } from "./tokenizers/code2prompt.js";
import type { RepomixResult } from "./tokenizers/repomix.js";
import type { TiktokenResult } from "./tokenizers/tiktoken.js";

export type BadgeStatus = "green" | "yellow" | "red";

export interface ModelReport {
  name: string;
  context_size: number;
  tiktoken_tokens: number;
  percent_used: number;
  status: BadgeStatus;
}

export interface AggregateReport {
  timestamp: string;
  tokenizers: {
    code2prompt: number;
    repomix: number;
    tiktoken: number;
  };
  models: ModelReport[];
  threshold_percent: number;
}

interface AggregateInput {
  config: Config;
  code2prompt: Code2PromptResult;
  repomix: RepomixResult;
  tiktoken: TiktokenResult;
}

function computeStatus(percent: number, threshold: number): BadgeStatus {
  if (percent > threshold) return "red";
  if (percent > 60) return "yellow";
  return "green";
}

export function aggregate(input: AggregateInput): AggregateReport {
  const { config, code2prompt, repomix, tiktoken } = input;

  const models: ModelReport[] = Object.entries(config.models).map(
    ([name, modelCfg]: [string, ModelConfig]) => {
      const percent = (tiktoken.totalTokens / modelCfg.context_size) * 100;
      return {
        name,
        context_size: modelCfg.context_size,
        tiktoken_tokens: tiktoken.totalTokens,
        percent_used: Math.round(percent * 100) / 100,
        status: computeStatus(percent, config.threshold_percent),
      };
    },
  );

  return {
    timestamp: new Date().toISOString(),
    tokenizers: {
      code2prompt: code2prompt.totalTokens,
      repomix: repomix.totalTokens,
      tiktoken: tiktoken.totalTokens,
    },
    models,
    threshold_percent: config.threshold_percent,
  };
}
