export function buildStandaloneHtml(payload, options = {}) {
  const generatedLabel = formatGeneratedAt(payload.generatedAt);
  const filterLabel = payload.query.trim() ? `Фильтр: ${payload.query.trim()}` : "Полный отчёт";
  const includeCover = options.includeCover !== false;

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ОГЭ Английский - ${escapeHtml(filterLabel)}</title>
  <style>
${standaloneStyles()}
  </style>
</head>
<body>
  <main class="page-shell">
    ${includeCover ? renderExportNav(payload.groups) : ""}
    ${
      includeCover
        ? `<section class="pdf-block pdf-cover">
      <header class="export-head">
        <div>
          <p class="eyebrow">ОГЭ · Английский · 9 класс</p>
          <h1>Отчёт по результатам</h1>
          <p class="meta">${escapeHtml(filterLabel)} · Сформировано: ${escapeHtml(generatedLabel)}</p>
        </div>
        <div class="meta-box">
          <div>Учеников: <strong>${payload.reports.length}</strong></div>
          <div>Групп: <strong>${payload.groups.length}</strong></div>
        </div>
      </header>
      ${renderGroupSummary(payload.groups)}
    </section>`
        : ""
    }
    ${payload.reports.map((report) => renderReport(report)).join("\n")}
  </main>
  ${includeCover ? exportNavScript() : ""}
</body>
</html>`;
}

export function buildFileName(extension, query) {
  const timestamp = formatFileTimestamp(new Date());
  const suffix = query.trim()
    ? `-${query
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9а-яё_-]/gi, "")}`
    : "";
  return `oge-english-report${suffix}-${timestamp}.${extension}`;
}

function formatFileTimestamp(value) {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${day}-${month}_${hours}-${minutes}`;
}

function renderGroupSummary(groups) {
  if (groups.length === 0) return "";
  return `<section class="group-summary">
    ${groups
      .map(
        (group) => `<article class="group-card">
          <h2 style="color:${escapeHtml(group.color)}">${escapeHtml(group.groupName)}</h2>
          <div class="chip-row">
            ${group.students
              .map(
                (student) =>
                  `<a class="name-chip" href="#${escapeHtml(student.studentKey)}" style="border-color:${escapeHtml(student.color)};color:${escapeHtml(student.color)}">${escapeHtml(student.shortName)}</a>`,
              )
              .join("")}
          </div>
        </article>`,
      )
      .join("")}
  </section>`;
}

function renderExportNav(groups) {
  if (groups.length === 0) return "";

  return `<nav class="export-nav nav-visible">
    ${groups
      .map(
        (group) => `<div class="export-nav-group">
          <span class="export-nav-label">${escapeHtml(group.groupName)}</span>
          <div class="export-nav-links">
            ${group.students
              .map(
                (student) =>
                  `<a href="#${escapeHtml(student.studentKey)}" style="border-color:${escapeHtml(student.color)};color:${escapeHtml(student.color)}">${escapeHtml(student.shortName)}</a>`,
              )
              .join("")}
          </div>
        </div>`,
      )
      .join("")}
  </nav>`;
}

function renderReport(report) {
  return `<section class="report-card report-start" id="${escapeHtml(report.studentKey)}">
    <div class="report-head" style="background:linear-gradient(135deg,${escapeHtml(report.colorA)},${escapeHtml(report.colorB)})">
      <div>
        <h2>${escapeHtml(report.fullName)}</h2>
        <p>Группа ${escapeHtml(report.groupName)}</p>
      </div>
      <div class="report-score">
        <strong>${report.latestScore}/53 · ${report.latestPercent.toFixed(1)}%</strong>
        <span>Средний: ${report.averagePercent.toFixed(1)}% · Тестов: ${report.testsCount}</span>
      </div>
    </div>
    <div class="report-body">
      <section class="pdf-block">
        <div class="metric-grid">
          ${metricCard("ПОСЛЕДНИЙ ТЕСТ", `${report.latestScore}/53`, toneClass(report.latestPercent))}
          ${metricCard("% последний", `${report.latestPercent.toFixed(1)}%`, toneClass(report.latestPercent))}
          ${metricCard("Ср. по тестам", `${report.averagePercent.toFixed(1)}%`, toneClass(report.averagePercent))}
          ${metricCard("Лучший", `${report.bestPercent.toFixed(1)}%`, toneClass(report.bestPercent))}
          ${metricCard("Тренд", escapeHtml(report.trendLabel), toneName(report.trendTone))}
        </div>
      </section>
      <section class="pdf-block">
        <div class="section-title" style="border-left-color:${escapeHtml(report.colorB)}">Динамика</div>
        <div class="chart-grid">
          <div class="panel">
            <div class="panel-title" style="color:${escapeHtml(report.colorA)}">По месяцам</div>
            ${renderMonthChart(report)}
          </div>
          <div class="panel wide">
            <div class="panel-title" style="color:${escapeHtml(report.colorA)}">По всем тестам</div>
            ${renderLineChart(report)}
          </div>
        </div>
      </section>
      <section class="pdf-block">
        <div class="section-title" style="border-left-color:${escapeHtml(report.colorB)}">Результаты по тестам</div>
        <div class="table-wrap">
          <table class="result-table">
            <thead>
              <tr>
                ${["Дата / Тест", "1 ч.", "%", "2 ч.", "%", "Итог", "%", "Уровень"]
                  .map((label) => `<th style="background:${escapeHtml(report.colorA)}">${label}</th>`)
                  .join("")}
              </tr>
            </thead>
            <tbody>${report.tests.map((test) => renderTestRow(test)).join("")}</tbody>
          </table>
        </div>
      </section>
      <section class="pdf-block">
        <div class="section-title" style="border-left-color:${escapeHtml(report.colorB)}">По разделам</div>
        <div class="table-wrap">
          <table class="section-table">
            <thead>
              <tr><th>Раздел</th><th>Задания</th><th>Ср. %</th><th>Оценка</th><th>Визуально</th></tr>
            </thead>
            <tbody>
              ${report.sections
                .map(
                  (section) => `<tr>
                    <td class="cell-strong">${escapeHtml(section.icon)} ${escapeHtml(section.title)}</td>
                    <td>${escapeHtml(section.taskRange)}</td>
                    <td style="color:${escapeHtml(section.color)};font-weight:800">${section.averagePercent.toFixed(1)}%</td>
                    <td><span class="badge ${badgeClass(section.averagePercent)}">${escapeHtml(section.levelLabel)}</span></td>
                    <td><div class="bar-bg"><div class="bar-fill" style="width:${section.averagePercent}%;background:${escapeHtml(section.color)}"></div></div></td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
      ${
        report.boosts?.length
          ? `<section class="pdf-block">
        <div class="section-title boost-title" style="border-left-color:#d53f8c">Boost</div>
        <div class="table-wrap boost-wrap">
          <table class="boost-table">
            <thead>
              <tr><th>Название</th><th>Темы отработки</th><th>% правильных ответов</th></tr>
            </thead>
            <tbody>
              ${report.boosts
                .map(
                  (boost) => `<tr>
                    <td class="boost-name">${escapeHtml(boost.title)}</td>
                    <td>${escapeHtml(boost.topics)}</td>
                    <td class="boost-percent">${Number(boost.percentCorrect).toFixed(1)}%</td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>`
          : ""
      }
      <section class="pdf-block">
        <div class="section-title" style="border-left-color:${escapeHtml(report.colorB)}">Выводы</div>
        <div class="rec-grid">
          ${renderRecBlock("Сильные стороны", report.strengths, "rec-g")}
          ${renderRecBlock("Зоны роста", report.growthAreas, "rec-r")}
          ${renderRecBlock("Тренд", [report.trendText], "rec-b")}
          ${renderRecBlock("Рекомендация", [report.recommendation], "rec-y")}
        </div>
      </section>
    </div>
  </section>`;
}

function renderTestRow(test) {
  if (!test.hasData) return `<tr class="skip-row"><td colspan="8">${escapeHtml(test.label)} - нет данных</td></tr>`;
  return `<tr${test.isExam ? ' class="exam-row"' : ""}>
    <td class="cell-strong">${escapeHtml(test.label)}</td>
    <td>${test.part1Score}</td>
    <td>${test.part1Percent.toFixed(1)}%</td>
    <td>${test.part2Score}</td>
    <td>${test.part2Percent.toFixed(1)}%</td>
    <td><strong>${test.totalScore}</strong></td>
    <td><strong>${test.totalPercent.toFixed(1)}%</strong></td>
    <td><span class="badge ${badgeClass(test.totalPercent)}">${escapeHtml(test.levelLabel)}</span></td>
  </tr>`;
}

function renderRecBlock(title, items, className) {
  return `<article class="rec ${className}"><h4>${escapeHtml(title)}</h4><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></article>`;
}

function renderMonthChart(report) {
  return `<div class="month-chart">
    ${report.monthlyBars
      .map((bar) => {
        const barStyle = bar.isExam ? "linear-gradient(to top,#c98f00,#f6e05e)" : `linear-gradient(to top,${bar.color},${bar.color}cc)`;
        return `<div class="month-col">
          <div class="month-val" style="color:${bar.isExam ? "#c98f00" : escapeHtml(bar.color)}">${bar.percent.toFixed(1)}%</div>
          <div class="month-bar-wrap"><div class="month-bar" style="height:${bar.percent}%;background:${barStyle};${bar.isExam ? "border:2px solid #e53e3e;" : ""}"></div></div>
          <div class="month-label" style="color:${bar.isExam ? "#e53e3e" : "#4a5568"}">${escapeHtml(bar.isExam ? "ЭКЗ" : bar.label)}</div>
        </div>`;
      })
      .join("")}
  </div>`;
}

function renderLineChart(report) {
  const tests = report.tests.filter((item) => item.hasData);
  if (tests.length === 0) return `<div class="no-data">Нет данных</div>`;
  const left = 40;
  const right = 530;
  const baseline = 132;
  const top = 12;
  const avgY = baseline - ((baseline - top) * report.averagePercent) / 100;
  const points = tests.map((test, index) => {
    const x = left + ((right - left) * index) / Math.max(1, tests.length - 1);
    const y = baseline - ((baseline - top) * test.totalPercent) / 100;
    return { ...test, x, y };
  });
  const poly = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${poly} ${right},${baseline} ${left},${baseline}`;

  return `<svg viewBox="0 0 580 160" xmlns="http://www.w3.org/2000/svg" class="line-svg">
    ${[25, 50, 75, 100]
      .map((mark) => {
        const y = baseline - ((baseline - top) * mark) / 100;
        return `<g><line x1="40" y1="${y}" x2="530" y2="${y}" stroke="#edf2f7" stroke-width="1" stroke-dasharray="3,3"></line><text x="36" y="${y + 3}" font-size="9" fill="#a0aec0" text-anchor="end">${mark}%</text></g>`;
      })
      .join("")}
    <line x1="40" y1="132" x2="530" y2="132" stroke="#cbd5e0" stroke-width="1.5"></line>
    <line x1="40" y1="${avgY}" x2="530" y2="${avgY}" stroke="#f6ad55" stroke-width="1.5" stroke-dasharray="5,4"></line>
    <text x="533" y="${avgY + 3}" font-size="9" fill="#c98f00" font-weight="bold">avg ${report.averagePercent.toFixed(1)}%</text>
    <polygon points="${area}" fill="${escapeHtml(report.colorB)}" opacity="0.08"></polygon>
    <polyline points="${poly}" fill="none" stroke="${escapeHtml(report.colorB)}" stroke-width="2.2" stroke-linejoin="round"></polyline>
    ${points
      .map(
        (point) => `<g><circle cx="${point.x}" cy="${point.y}" r="4" fill="${escapeHtml(report.colorB)}"></circle><text x="${point.x}" y="${point.y < 28 ? point.y + 14 : point.y - 6}" font-size="8.5" fill="${escapeHtml(report.colorB)}" text-anchor="middle" font-weight="bold">${point.totalPercent.toFixed(1)}%</text><text x="${point.x}" y="144" font-size="8" fill="#718096" text-anchor="middle">${escapeHtml(point.shortLabel)}</text></g>`,
      )
      .join("")}
  </svg>`;
}

function metricCard(label, value, tone) {
  return `<div class="metric-card ${escapeHtml(tone)}"><div class="metric-value">${value}</div><div class="metric-label">${escapeHtml(label)}</div></div>`;
}

function standaloneStyles() {
  return `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:"Segoe UI",Arial,sans-serif;color:#1a202c;background:#fff}
.page-shell{max-width:1180px;margin:0 auto;padding:24px 16px 40px}
.export-nav{position:sticky;top:0;z-index:20;display:grid;gap:10px;margin-bottom:18px;padding:14px 16px;border-radius:18px;background:rgba(19,32,51,.94);backdrop-filter:blur(10px);box-shadow:0 12px 30px rgba(15,23,42,.18);transition:transform .22s ease,opacity .22s ease;transform:translateY(0);opacity:1}
.export-nav.nav-visible{transform:translateY(0);opacity:1;pointer-events:auto}
.export-nav.nav-hidden{transform:translateY(calc(-100% - 6px));opacity:.02;pointer-events:none}
.export-nav-group{display:grid;gap:6px}
.export-nav-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd}
.export-nav-links{display:flex;flex-wrap:wrap;gap:8px;min-width:0}
.export-nav-links a{display:inline-flex;align-items:center;padding:6px 10px;border:1px solid #4a5568;border-radius:999px;background:rgba(255,255,255,.08);font-size:12px;font-weight:700;text-decoration:none;max-width:100%}
.pdf-block{break-inside:avoid;page-break-inside:avoid}
.pdf-cover{display:grid;gap:18px}
.export-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;background:#132033;color:white;border-radius:22px;padding:24px 26px;box-shadow:0 18px 45px rgba(15,23,42,.18)}
.eyebrow{margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd}
.export-head h1{margin:0;font-size:30px;line-height:1.1}
.meta{margin:10px 0 0;color:#cbd5e1;font-size:14px}
.meta-box{min-width:220px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px 16px;display:grid;gap:8px;font-size:14px}
.group-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0 8px}
.group-card{background:white;border-radius:18px;padding:16px 18px;box-shadow:0 10px 30px rgba(15,23,42,.08)}
.group-card h2{margin:0 0 12px;font-size:20px}
.chip-row{display:flex;flex-wrap:wrap;gap:8px}
.name-chip{display:inline-flex;align-items:center;padding:6px 10px;border:1px solid #cbd5e0;border-radius:999px;font-size:12px;font-weight:700;background:#fff;text-decoration:none}
.report-card{margin-top:26px;background:white;border-radius:20px;box-shadow:0 10px 32px rgba(15,23,42,.08);overflow:hidden;break-inside:avoid;page-break-inside:avoid}
.report-start{break-before:page;page-break-before:always}
.report-start:first-of-type{break-before:auto;page-break-before:auto}
.report-head{padding:22px 28px;color:white;display:flex;justify-content:space-between;gap:20px;align-items:flex-start}
.report-head h2{margin:0;font-size:24px}
.report-head p{margin:6px 0 0;opacity:.85;font-size:13px}
.report-score{text-align:right;display:grid;gap:4px}
.report-score strong{font-size:21px}
.report-score span{font-size:12px;opacity:.88}
.report-body{padding:22px 24px;display:grid;gap:16px}
.metric-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.metric-card{background:#f7fafc;border-radius:12px;padding:14px 10px;text-align:center;border-top:4px solid #cbd5e0}
.metric-card.c-great{border-top-color:#276749}.metric-card.c-good{border-top-color:#2b6cb0}.metric-card.c-warn{border-top-color:#d69e2e}.metric-card.c-bad{border-top-color:#e53e3e}
.metric-value{font-size:21px;font-weight:900;line-height:1.05}
.metric-card.c-great .metric-value{color:#276749}.metric-card.c-good .metric-value{color:#2b6cb0}.metric-card.c-warn .metric-value{color:#c98f00}.metric-card.c-bad .metric-value{color:#e53e3e}
.metric-label{margin-top:5px;font-size:10px;color:#718096;text-transform:uppercase;letter-spacing:.06em}
.section-title{font-size:14px;font-weight:800;border-left:4px solid #276749;padding-left:10px}
.chart-grid{display:grid;grid-template-columns:240px minmax(0,1fr);gap:12px}
.panel{background:#f7fafc;border-radius:12px;padding:14px}
.panel-title{font-size:12px;font-weight:800;margin-bottom:10px}
.month-chart{display:flex;align-items:flex-end;gap:4px;height:112px;border-bottom:1.5px solid #cbd5e0}
.month-col{display:flex;flex-direction:column;align-items:center;flex:1;min-width:0}
.month-bar-wrap{width:100%;height:82px;display:flex;align-items:flex-end;justify-content:center}
.month-bar{width:78%;border-radius:4px 4px 0 0}
.month-val{font-size:10px;font-weight:800;margin-bottom:2px}
.month-label{font-size:9px;font-weight:700;margin-top:4px;text-align:center}
.line-svg{display:block;width:100%;height:auto}
.table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:10px}
table{width:100%;border-collapse:collapse}
.result-table{min-width:560px;font-size:12px}
.result-table th{color:white;padding:9px 10px;text-align:center}
.result-table th:first-child{text-align:left}
.result-table td{padding:7px 10px;border-bottom:1px solid #edf2f7;text-align:center}
.result-table td:first-child{text-align:left}
.result-table tbody tr:nth-child(even) td{background:#f7fafc}
.result-table .skip-row td{font-style:italic;color:#a0aec0;text-align:left}
.result-table .exam-row td{background:#fefce8}
.section-table{min-width:460px;font-size:13px}
.section-table th{background:#2d3748;color:white;padding:9px 12px;text-align:left}
.section-table td{padding:8px 12px;border-bottom:1px solid #edf2f7}
.boost-title{color:#702459}
.boost-wrap{border-color:#f3c4dd;background:#fff7fb}
.boost-table{min-width:460px;font-size:13px}
.boost-table th{background:#d53f8c;color:white;padding:9px 12px;text-align:left}
.boost-table td{padding:8px 12px;border-bottom:1px solid #f8d7e8}
.boost-table tbody tr:nth-child(even) td{background:#fff0f7}
.boost-name{font-weight:700;color:#97266d;white-space:nowrap}
.boost-percent{font-weight:800;color:#b83280}
.cell-strong{font-weight:700}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800}
.bg{background:#c6f6d5;color:#1a4731}.bb{background:#bee3f8;color:#1a365d}.bw{background:#fefcbf;color:#7b6a00}.bd{background:#fed7d7;color:#9b2c2c}
.bar-bg{width:130px;height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden}
.bar-fill{height:100%;border-radius:999px}
.rec-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rec{border-radius:12px;padding:14px 16px}
.rec h4{margin:0 0 8px;font-size:13px;font-weight:800}
.rec ul{margin:0;padding:0;list-style:none}
.rec li{position:relative;padding:3px 0 3px 14px;font-size:12px;color:#4a5568;line-height:1.45;overflow-wrap:anywhere;word-break:break-word}
.rec li::before{content:"•";position:absolute;left:0}
.rec-g{background:#f0fff4}.rec-g h4{color:#1a4731}.rec-g li::before{color:#48bb78}
.rec-r{background:#fff5f5}.rec-r h4{color:#9b2c2c}.rec-r li::before{color:#fc8181}
.rec-b{background:#ebf8ff}.rec-b h4{color:#1a365d}.rec-b li::before{color:#4299e1}
.rec-y{background:#fffbeb}.rec-y h4{color:#7b6a00}.rec-y li::before{color:#ecc94b}
.no-data{padding:18px;text-align:center;color:#94a3b8}
@media (max-width:1100px){.page-shell{padding:20px 14px 34px}.group-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.metric-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.chart-grid{grid-template-columns:1fr}}
@media (max-width:900px){.export-head{padding:20px;display:grid;gap:16px}.meta-box{min-width:0}.report-head{padding:20px;display:grid;gap:10px}.report-score{text-align:left}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.chart-grid{grid-template-columns:1fr}.group-summary{grid-template-columns:1fr}.rec-grid{grid-template-columns:1fr}.bar-bg{width:100%;max-width:180px}}
@media (max-width:768px){.page-shell{padding:14px 12px 28px}.export-nav{padding:12px;top:0;border-radius:14px;gap:8px}.export-nav-group{gap:5px}.export-nav-label{font-size:10px}.export-nav-links{display:flex;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;padding-bottom:4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.export-nav-links::-webkit-scrollbar{display:none}.export-nav-links a{font-size:11px;padding:5px 9px;white-space:nowrap;flex:0 0 auto}.export-head{padding:18px;border-radius:18px;display:grid}.export-head h1{font-size:24px}.meta{font-size:13px}.group-card{padding:14px 15px;border-radius:16px}.report-card{margin-top:18px;border-radius:16px}.report-head{padding:18px;display:grid}.report-head h2{font-size:21px}.report-body{padding:16px 14px;gap:14px}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.metric-card{padding:12px 8px}.metric-value{font-size:18px}.section-title{font-size:13px}.panel{padding:12px}.month-chart{height:104px}.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}.result-table{min-width:520px}.section-table{min-width:420px}.boost-table{min-width:420px}.rec-grid{grid-template-columns:1fr}.rec{padding:12px 14px}.rec h4{font-size:12px}}
@media (max-width:520px){.page-shell{padding:12px 10px 24px}.export-nav{margin-bottom:14px}.export-head h1{font-size:22px}.report-head h2{font-size:19px}.metric-grid{grid-template-columns:1fr}.result-table{min-width:500px}.section-table{min-width:380px}.boost-table{min-width:380px}.month-label{font-size:8px}.rec li{font-size:11px}}
@page{size:A4;margin:10mm}`;
}

function badgeClass(value) {
  if (value >= 85) return "bg";
  if (value >= 70) return "bb";
  if (value >= 55) return "bw";
  return "bd";
}

function toneClass(value) {
  if (value >= 85) return "c-great";
  if (value >= 70) return "c-good";
  if (value >= 55) return "c-warn";
  return "c-bad";
}

function toneName(value) {
  if (value === "great") return "c-great";
  if (value === "good") return "c-good";
  if (value === "warn") return "c-warn";
  return "c-bad";
}

function formatGeneratedAt(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function exportNavScript() {
  return `<script>
(() => {
  const nav = document.querySelector('.export-nav');
  if (!nav) return;
  let lastY = window.scrollY;
  let downDistance = 0;
  let upDistance = 0;

  const onScroll = () => {
    const currentY = window.scrollY;
    const delta = currentY - lastY;

    if (currentY <= 24) {
      nav.classList.remove('nav-hidden');
      nav.classList.add('nav-visible');
      downDistance = 0;
      upDistance = 0;
      lastY = currentY;
      return;
    }

    if (delta > 0) {
      downDistance += delta;
      upDistance = 0;
      if (downDistance > 18) {
        nav.classList.add('nav-hidden');
        nav.classList.remove('nav-visible');
      }
    } else if (delta < 0) {
      upDistance += Math.abs(delta);
      downDistance = 0;
      if (upDistance > 8) {
        nav.classList.remove('nav-hidden');
        nav.classList.add('nav-visible');
      }
    }

    lastY = currentY;
  };

  window.addEventListener('scroll', onScroll, { passive: true });
})();
</script>`;
}
