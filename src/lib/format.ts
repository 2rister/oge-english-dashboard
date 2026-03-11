import type { MetricTone } from "../types";

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatPercent(value: number): string {
  return `${Math.round(clampPercent(value))}%`;
}

export function formatTrend(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${Math.round(delta)}%`;
}

export function toneFromPercent(value: number): MetricTone {
  if (value >= 85) return "great";
  if (value >= 70) return "good";
  if (value >= 55) return "warn";
  return "bad";
}

export function levelLabel(value: number): string {
  if (value >= 85) return "Отлично";
  if (value >= 70) return "Хорошо";
  if (value >= 55) return "Средне";
  return "Нужно усиление";
}
