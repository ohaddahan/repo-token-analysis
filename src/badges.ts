import { makeBadge } from "badge-maker";
import type { AggregateReport, BadgeStatus } from "./aggregate.js";

const STATUS_COLORS: Record<BadgeStatus, string> = {
  green: "brightgreen",
  yellow: "yellow",
  red: "red",
};

export interface BadgeOutput {
  model: string;
  svg: string;
}

export function generateBadges(report: AggregateReport): BadgeOutput[] {
  return report.models.map((model) => {
    const svg = makeBadge({
      label: model.name,
      message: `${model.percent_used}% context`,
      color: STATUS_COLORS[model.status],
    });

    return { model: model.name, svg };
  });
}
