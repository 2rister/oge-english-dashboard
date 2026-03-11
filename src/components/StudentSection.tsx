import type { StudentReport } from "../types";
import { StudentMetrics } from "./MetricCard";
import { ProgressChart } from "./ProgressChart";
import { StudentTable } from "./StudentTable";
import { SectionTable } from "./SectionTable";
import { Insights } from "./Insights";

export function StudentSection({ student }: { student: StudentReport }) {
  return (
    <section className="student-section" id={student.studentKey}>
      <div
        className="s-header"
        style={{ background: `linear-gradient(135deg, ${student.colorA}, ${student.colorB})` }}
      >
        <div>
          <span className="eyebrow">{student.groupName}</span>
          <h2>{student.fullName}</h2>
        </div>
        <div className="header-stats">
          <strong>{student.latestScore}/53</strong>
          <span>{Math.round(student.averagePercent)}% средний результат</span>
        </div>
      </div>

      <div className="s-body">
        <StudentMetrics
          latestScore={student.latestScore}
          latestPercent={student.latestPercent}
          averagePercent={student.averagePercent}
          bestPercent={student.bestPercent}
          trendDelta={student.trendDelta}
        />

        <h3 className="stitle">Динамика</h3>
        <div className="charts-row">
          <div className="chart-box chart-box-full">
            <ProgressChart tests={student.tests} color={student.colorB} />
          </div>
        </div>

        <h3 className="stitle">Результаты по тестам</h3>
        <StudentTable tests={student.tests} />

        <h3 className="stitle">Разделы</h3>
        <SectionTable sections={student.sections} />

        <h3 className="stitle">Выводы</h3>
        <Insights
          strengths={student.strengths}
          growthAreas={student.growthAreas}
          trendText={student.trendText}
          recommendation={student.recommendation}
        />
      </div>
    </section>
  );
}
