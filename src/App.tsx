import { useEffect, useMemo, useRef, useState } from "react";
import { loadReportData, type ReportData, type StudentReportData } from "./lib/reportData";
import { downloadReportHtml, downloadReportPdf } from "./lib/exportReport";

function clsTone(value: string) {
  if (value === "great") return "c-great";
  if (value === "good") return "c-good";
  if (value === "warn") return "c-warn";
  return "c-bad";
}

function toneFromPercent(value: number) {
  if (value >= 85) return "great";
  if (value >= 70) return "good";
  if (value >= 55) return "warn";
  return "bad";
}

function badgeClass(value: number) {
  if (value >= 85) return "bg";
  if (value >= 70) return "bb";
  if (value >= 55) return "bw";
  return "bd";
}

function lineChart(report: StudentReportData) {
  const tests = report.tests.filter((item) => item.hasData);
  if (tests.length === 0) {
    return <div className="no-data">Нет данных</div>;
  }

  const left = 40;
  const right = 530;
  const baseline = 132;
  const top = 12;
  const avg = report.averagePercent;
  const points = tests.map((test, index) => {
    const x = left + ((right - left) * index) / Math.max(1, tests.length - 1);
    const y = baseline - ((baseline - top) * test.totalPercent) / 100;
    return { ...test, x, y };
  });
  const poly = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${poly} ${right},${baseline} ${left},${baseline}`;
  const avgY = baseline - ((baseline - top) * avg) / 100;

  return (
    <svg viewBox="0 0 580 160" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", display: "block" }}>
      {[25, 50, 75, 100].map((mark) => {
        const y = baseline - ((baseline - top) * mark) / 100;
        return (
          <g key={mark}>
            <line x1="40" y1={y} x2="530" y2={y} stroke="#edf2f7" strokeWidth="1" strokeDasharray="3,3" />
            <text x="36" y={y + 3} fontSize="9" fill="#a0aec0" textAnchor="end">
              {mark}%
            </text>
          </g>
        );
      })}
      <line x1="40" y1="132" x2="530" y2="132" stroke="#cbd5e0" strokeWidth="1.5" />
      <line x1="40" y1={avgY} x2="530" y2={avgY} stroke="#f6ad55" strokeWidth="1.5" strokeDasharray="5,4" />
      <text x="533" y={avgY + 3} fontSize="9" fill="#c98f00" fontWeight="bold">
        avg {report.averagePercent.toFixed(1)}%
      </text>
      <polygon points={`${area}`} fill={report.colorB} opacity="0.08" />
      <polyline points={poly} fill="none" stroke={report.colorB} strokeWidth="2.2" strokeLinejoin="round" />
      {points.map((point) => (
        <g key={point.sheetName}>
          <circle cx={point.x} cy={point.y} r="4" fill={report.colorB} />
          <text x={point.x} y={point.y < 28 ? point.y + 14 : point.y - 6} fontSize="8.5" fill={report.colorB} textAnchor="middle" fontWeight="bold">
            {point.totalPercent.toFixed(1)}%
          </text>
          <text x={point.x} y="144" fontSize="8" fill="#718096" textAnchor="middle">
            {point.shortLabel}
          </text>
        </g>
      ))}
    </svg>
  );
}

function monthChart(report: StudentReportData) {
  return (
    <div className="mc-wrap">
      <div className="avg-line-box" style={{ bottom: `calc(${report.averagePercent}% + 2px)` }}>
        <span className="avg-tag">avg {report.averagePercent.toFixed(1)}%</span>
      </div>
      <div className="mc-chart">
        {report.monthlyBars.map((bar) => (
          <div className="mc-col" key={bar.label}>
            <div className="mc-val" style={{ color: bar.isExam ? "#c98f00" : bar.color }}>
              {bar.percent.toFixed(1)}%
            </div>
            <div className="mc-bar-wrap">
              <div
                className="mc-bar"
                style={{
                  height: `${bar.percent}%`,
                  background: bar.isExam ? "linear-gradient(to top,#c98f00,#f6e05e)" : `linear-gradient(to top,${bar.color},${bar.color}cc)`,
                  border: bar.isExam ? "2px solid #e53e3e" : "none",
                }}
              />
            </div>
            <div className="mc-lbl" style={{ color: bar.isExam ? "#e53e3e" : "#4a5568" }}>
              {bar.isExam ? "📋 ЭКЗ" : bar.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function studentSection(report: StudentReportData) {
  return (
    <section className="student-section" id={report.studentKey} key={report.id}>
      <div className="s-header" style={{ background: `linear-gradient(135deg,${report.colorA},${report.colorB})` }}>
        <div className="s-header-left">
          <h2>{report.fullName}</h2>
          <p>Группа {report.groupName}</p>
        </div>
        <div className="s-header-right">
          <div className="exam-chip">🎓 {report.latestScore}/53 · {report.latestPercent.toFixed(1)}%</div>
          <div className="sub-chip">Средний: {report.averagePercent.toFixed(1)}% · Тестов: {report.testsCount}</div>
        </div>
      </div>
      <div className="s-body">
        <div className="cards-row">
          <div className={`kcard ${clsTone(toneFromPercent(report.latestPercent))}`}><div className="kval">{report.latestScore}/53</div><div className="klbl">ПОСЛЕДНИЙ ТЕСТ</div></div>
          <div className={`kcard ${clsTone(toneFromPercent(report.latestPercent))}`}><div className="kval">{report.latestPercent.toFixed(1)}%</div><div className="klbl">% последний</div></div>
          <div className={`kcard ${clsTone(toneFromPercent(report.averagePercent))}`}><div className="kval">{report.averagePercent.toFixed(1)}%</div><div className="klbl">Ср. по тестам</div></div>
          <div className={`kcard ${clsTone(toneFromPercent(report.bestPercent))}`}><div className="kval">{report.bestPercent.toFixed(1)}%</div><div className="klbl">Лучший</div></div>
          <div className={`kcard ${clsTone(report.trendTone)}`}><div className="kval trend-val">{report.trendLabel}</div><div className="klbl">Тренд</div></div>
        </div>

        <div className="stitle" style={{ borderLeftColor: report.colorB }}>📅 Динамика</div>
        <div className="charts-row">
          <div className="chart-box">
            <div className="chart-title" style={{ color: report.colorA }}>По месяцам</div>
            {monthChart(report)}
          </div>
          <div className="chart-box chart-wide">
            <div className="chart-title" style={{ color: report.colorA }}>По всем тестам</div>
            {lineChart(report)}
          </div>
        </div>

        <div className="stitle" style={{ borderLeftColor: report.colorB }}>🗂 Результаты по тестам</div>
        <div className="tbl-wrap">
          <table className="rtable">
            <thead>
              <tr>
                <th style={{ background: report.colorA }}>Дата / Тест</th>
                <th style={{ background: report.colorA }}>1 ч.</th>
                <th style={{ background: report.colorA }}>%</th>
                <th style={{ background: report.colorA }}>2 ч.</th>
                <th style={{ background: report.colorA }}>%</th>
                <th style={{ background: report.colorA }}>Итог</th>
                <th style={{ background: report.colorA }}>%</th>
                <th style={{ background: report.colorA }}>Уровень</th>
              </tr>
            </thead>
            <tbody>
              {report.tests.map((test) =>
                test.hasData ? (
                  <tr key={test.sheetName} style={test.isExam ? { background: "#fefce8" } : undefined}>
                    <td className="td-lbl">{test.isExam ? <b>{test.label}</b> : test.label}</td>
                    <td>{test.part1Score}</td>
                    <td>{test.part1Percent.toFixed(1)}%</td>
                    <td>{test.part2Score}</td>
                    <td>{test.part2Percent.toFixed(1)}%</td>
                    <td><b>{test.totalScore}</b></td>
                    <td><b>{test.totalPercent.toFixed(1)}%</b></td>
                    <td><span className={`badge ${badgeClass(test.totalPercent)}`}>{test.levelLabel}</span></td>
                  </tr>
                ) : (
                  <tr className="skip-row" key={test.sheetName}>
                    <td colSpan={8}>{test.label} — нет данных</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        <div className="stitle" style={{ borderLeftColor: report.colorB }}>📊 По разделам</div>
        <div className="sec-tbl-wrap">
          <table className="sec-table">
            <thead>
              <tr>
                <th>Раздел</th>
                <th>Задания</th>
                <th>Ср. %</th>
                <th>Оценка</th>
                <th>Визуально</th>
              </tr>
            </thead>
            <tbody>
              {report.sections.map((section) => (
                <tr key={section.key}>
                  <td className="sec-td">{section.icon} {section.title}</td>
                  <td>{section.taskRange}</td>
                  <td style={{ color: section.color, fontWeight: 800 }}>{section.averagePercent.toFixed(1)}%</td>
                  <td><span className={`badge ${badgeClass(section.averagePercent)}`}>{section.levelLabel}</span></td>
                  <td><div className="bar-bg"><div className="bar-fill" style={{ width: `${section.averagePercent}%`, background: section.color }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {report.boosts.length > 0 ? (
          <>
            <div className="stitle boost-title" style={{ borderLeftColor: "#d53f8c" }}>💗 Boost</div>
            <div className="boost-tbl-wrap">
              <table className="boost-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Темы отработки</th>
                    <th>% правильных ответов</th>
                  </tr>
                </thead>
                <tbody>
                  {report.boosts.map((boost) => (
                    <tr key={`${report.studentKey}-${boost.title}`}>
                      <td className="boost-name">{boost.title}</td>
                      <td>{boost.topics}</td>
                      <td className="boost-percent">{boost.percentCorrect.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        <div className="stitle" style={{ borderLeftColor: report.colorB }}>🧠 Выводы</div>
        <div className="recs-grid">
          <div className="rec rec-g"><h4>✅ Сильные стороны</h4><ul>{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div className="rec rec-r"><h4>⚠ Зоны роста</h4><ul>{report.growthAreas.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div className="rec rec-b"><h4>📈 Тренд</h4><ul><li>{report.trendText}</li></ul></div>
          <div className="rec rec-y"><h4>🎯 Рекомендация</h4><ul><li>{report.recommendation}</li></ul></div>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [data, setData] = useState<ReportData | null>(null);
  const [query, setQuery] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const downDistanceRef = useRef(0);
  const upDistanceRef = useRef(0);

  const reloadReports = async () => {
    setStatus("loading");
    try {
      const payload = await loadReportData();
      setData(payload);
      setStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось загрузить данные";
      setError(message);
      setStatus("error");
    }
  };

  useEffect(() => {
    void reloadReports();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;

      if (currentY <= 24) {
        setNavVisible(true);
        downDistanceRef.current = 0;
        upDistanceRef.current = 0;
        lastScrollYRef.current = currentY;
        return;
      }

      if (delta > 0) {
        downDistanceRef.current += delta;
        upDistanceRef.current = 0;
        if (downDistanceRef.current > 18) {
          setNavVisible(false);
        }
      } else if (delta < 0) {
        upDistanceRef.current += Math.abs(delta);
        downDistanceRef.current = 0;
        if (upDistanceRef.current > 8) {
          setNavVisible(true);
        }
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".save-menu")) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const reports = data?.reports ?? [];
    if (!normalized) return reports;
    return reports.filter((item) => item.fullName.toLowerCase().includes(normalized) || item.groupName.toLowerCase().includes(normalized));
  }, [data, query]);

  const visibleGroups = useMemo(() => {
    if (!data) return [];
    const keys = new Set(filtered.map((item) => item.studentKey));
    return data.groups
      .map((group) => ({ ...group, students: group.students.filter((student) => keys.has(student.studentKey)) }))
      .filter((group) => group.students.length > 0);
  }, [data, filtered]);

  const handleExport = async (format: "pdf" | "html") => {
    if (!data || filtered.length === 0) {
      return;
    }

    const payload = {
      generatedAt: data.generatedAt,
      reports: filtered,
      groups: visibleGroups,
      query,
    };

    setExportMenuOpen(false);

    if (format === "html") {
      downloadReportHtml(payload);
      return;
    }

    await downloadReportPdf(payload);
  };

  return (
    <main>
      {status === "ready" && data ? (
        <>
          <nav className={`desktop-nav desktop-only ${navVisible ? "nav-visible" : "nav-hidden"}`}>
            <div className="nav-links">
              <label className="nav-search">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Поиск по фамилии"
                />
              </label>
              {visibleGroups.map((group, index) => (
                <div className="nav-group" key={group.groupName}>
                  <span className="dnav-lbl">{group.groupName}:</span>
                  {group.students.map((student) => (
                    <a href={`#${student.studentKey}`} key={student.studentKey} style={{ borderColor: student.color, color: student.color }}>
                      {student.shortName}
                    </a>
                  ))}
                  {index < visibleGroups.length - 1 ? <span className="dnav-sep">|</span> : null}
                </div>
              ))}
            </div>
            <div className="save-menu">
              <button
                className="save-trigger"
                type="button"
                onClick={() => setExportMenuOpen((current) => !current)}
                disabled={filtered.length === 0}
              >
                <span>Save as</span>
                <span className={`save-arrow ${exportMenuOpen ? "open" : ""}`}>▾</span>
              </button>
              {exportMenuOpen ? (
                <div className="save-dropdown">
                  <button type="button" onClick={() => void handleExport("pdf")}>
                    PDF
                  </button>
                  <button type="button" onClick={() => void handleExport("html")}>
                    HTML
                  </button>
                </div>
              ) : null}
            </div>
          </nav>

          <nav className={`mobile-nav mobile-only ${navVisible ? "nav-visible" : "nav-hidden"}`}>
            <div className="mobile-nav-top">
              <strong>ОГЭ · Английский</strong>
            </div>
            {visibleGroups.map((group) => (
              <div className="mobile-nav-grp" key={group.groupName}>
                <span className="mobile-nav-grp-lbl">{group.groupName}</span>
                {group.students.map((student) => (
                  <a href={`#${student.studentKey}`} key={student.studentKey}>
                    {student.shortName}
                  </a>
                ))}
              </div>
            ))}
            <label className="mobile-search">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по фамилии"
              />
            </label>
          </nav>
        </>
      ) : null}

      {status === "ready" && data ? (
        <section className="mobile-export mobile-only">
          <div className="save-menu mobile-save-menu">
            <button
              className="save-trigger"
              type="button"
              onClick={() => setExportMenuOpen((current) => !current)}
              disabled={filtered.length === 0}
            >
              <span>Save as</span>
              <span className={`save-arrow ${exportMenuOpen ? "open" : ""}`}>▾</span>
            </button>
            {exportMenuOpen ? (
              <div className="save-dropdown">
                <button type="button" onClick={() => void handleExport("pdf")}>
                  PDF
                </button>
                <button type="button" onClick={() => void handleExport("html")}>
                  HTML
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {status === "loading" ? <section className="state-card">Загрузка данных из PocketBase...</section> : null}
      {status === "error" ? (
        <section className="state-card state-error">
          <h2>Не удалось загрузить данные</h2>
          <p>{error}</p>
          <p>Проверь `VITE_PB_URL`, доступность PocketBase и наличие данных в коллекциях.</p>
        </section>
      ) : null}
      {status === "ready" && filtered.length === 0 ? (
        <section className="state-card">По текущему фильтру учеников не найдено.</section>
      ) : null}
      {status === "ready" && data
        ? visibleGroups.map((group) => (
            <div key={group.groupName}>
              <div className="grp-label-desktop desktop-only">
                <h3 style={{ color: group.color, borderLeftColor: group.color }}>🏫 Группа {group.groupName}</h3>
              </div>
              <div className="grp-label-mobile mobile-only">
                <h3 style={{ color: group.color, borderLeftColor: group.color }}>🏫 Группа {group.groupName}</h3>
              </div>
              {filtered.filter((report) => report.groupName === group.groupName).map((report) => studentSection(report))}
            </div>
          ))
        : null}
    </main>
  );
}

export default App;
