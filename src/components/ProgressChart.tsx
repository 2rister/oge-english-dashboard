import type { TestResult } from "../types";
import { formatPercent, round } from "../lib/format";

type ProgressChartProps = {
  tests: TestResult[];
  color: string;
};

export function ProgressChart({ tests, color }: ProgressChartProps) {
  if (tests.length === 0) {
    return <div className="chart-empty">Нет данных по тестам</div>;
  }

  const width = 600;
  const height = 160;
  const left = 36;
  const right = 550;
  const baseline = 132;
  const top = 12;
  const average = tests.reduce((sum, item) => sum + item.writtenPercent, 0) / tests.length;

  const points = tests.map((test, index) => {
    const x = left + ((right - left) * index) / Math.max(1, tests.length - 1);
    const y = baseline - ((baseline - top) * test.writtenPercent) / 100;
    return { ...test, x, y };
  });

  const polyline = points.map((point) => `${round(point.x, 2)},${round(point.y, 2)}`).join(" ");
  const averageY = baseline - ((baseline - top) * average) / 100;

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="График прогресса">
      {[25, 50, 75, 100].map((mark) => {
        const y = baseline - ((baseline - top) * mark) / 100;
        return (
          <g key={mark}>
            <line x1={left} y1={y} x2={right} y2={y} className="grid-line" />
            <text x={8} y={y + 4} className="axis-label">
              {mark}%
            </text>
          </g>
        );
      })}
      <line x1={left} y1={baseline} x2={right} y2={baseline} className="base-line" />
      <line x1={left} y1={averageY} x2={right} y2={averageY} className="avg-line" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point) => (
        <g key={point.id}>
          <circle cx={point.x} cy={point.y} r="4" fill={color} />
          <text x={point.x} y={point.y - 10} textAnchor="middle" className="point-value">
            {formatPercent(point.writtenPercent)}
          </text>
          <text x={point.x} y={144} textAnchor="middle" className="axis-label">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
