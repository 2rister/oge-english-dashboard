export function Insights(props: {
  strengths: string[];
  growthAreas: string[];
  trendText: string;
  recommendation: string;
}) {
  return (
    <div className="recs-grid">
      <article className="insight-card insight-strong">
        <h4>Сильные стороны</h4>
        <p>{props.strengths.join("; ")}</p>
      </article>
      <article className="insight-card insight-risk">
        <h4>Зоны роста</h4>
        <p>{props.growthAreas.join("; ")}</p>
      </article>
      <article className="insight-card insight-trend">
        <h4>Тренд</h4>
        <p>{props.trendText}</p>
      </article>
      <article className="insight-card insight-action">
        <h4>Рекомендация</h4>
        <p>{props.recommendation}</p>
      </article>
    </div>
  );
}
