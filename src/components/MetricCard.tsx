import { formatPercent, formatTrend, toneFromPercent } from "../lib/format";

type MetricCardProps = {
  label: string;
  value: string;
  toneValue: number;
  hint?: string;
};

export function MetricCard({ label, value, toneValue, hint }: MetricCardProps) {
  const tone = toneFromPercent(toneValue);

  return (
    <article className={`metric-card metric-${tone}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {hint ? <span className="metric-hint">{hint}</span> : null}
    </article>
  );
}

export function StudentMetrics(props: {
  latestScore: number;
  latestPercent: number;
  averagePercent: number;
  bestPercent: number;
  trendDelta: number;
}) {
  return (
    <div className="cards-row">
      <MetricCard label="Последний балл" value={`${props.latestScore}/53`} toneValue={props.latestPercent} />
      <MetricCard label="Последний %" value={formatPercent(props.latestPercent)} toneValue={props.latestPercent} />
      <MetricCard label="Средний %" value={formatPercent(props.averagePercent)} toneValue={props.averagePercent} />
      <MetricCard label="Лучший %" value={formatPercent(props.bestPercent)} toneValue={props.bestPercent} />
      <MetricCard
        label="Тренд"
        value={formatTrend(props.trendDelta)}
        toneValue={props.latestPercent + props.trendDelta}
        hint={props.trendDelta < 0 ? "Есть просадка" : "Движение по тестам"}
      />
    </div>
  );
}
