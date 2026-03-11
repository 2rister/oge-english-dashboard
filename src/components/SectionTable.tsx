import type { SectionAverage } from "../types";
import { formatPercent, levelLabel, toneFromPercent } from "../lib/format";

export function SectionTable({ sections }: { sections: SectionAverage[] }) {
  return (
    <div className="sec-tbl-wrap">
      <table className="data-table section-table">
        <thead>
          <tr>
            <th>Раздел</th>
            <th>Зад.</th>
            <th>Ср.%</th>
            <th>Оценка</th>
            <th>Визуально</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const tone = toneFromPercent(section.averagePercent);
            return (
              <tr key={section.key}>
                <td>{section.title}</td>
                <td>{section.taskRange}</td>
                <td>{formatPercent(section.averagePercent)}</td>
                <td>{levelLabel(section.averagePercent)}</td>
                <td>
                  <div className="progress-track">
                    <div className={`progress-fill progress-${tone}`} style={{ width: `${section.averagePercent}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
