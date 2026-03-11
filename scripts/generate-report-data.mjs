import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

const XLSX = xlsx;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const cliFilePath = getCliOptionValue("--file");

const PALETTE = [
  ["#1a4731", "#276749"],
  ["#1a365d", "#2b6cb0"],
  ["#44337a", "#6b46c1"],
  ["#5f370e", "#dd6b20"],
  ["#065666", "#0987a0"],
  ["#1a3a5c", "#2c5282"],
  ["#63171b", "#c53030"],
  ["#276749", "#38a169"],
  ["#44337a", "#805ad5"],
  ["#5f370e", "#c05621"],
  ["#065666", "#319795"],
  ["#1a3a5c", "#4a5568"],
];

const SECTION_CONFIG = [
  { key: "listening", icon: "🎧", title: "Аудирование", slice: [2, 13], taskRange: "1-11" },
  { key: "reading", icon: "📖", title: "Чтение", slice: [13, 21], taskRange: "12-19" },
  { key: "grammar", icon: "✏️", title: "Грамматика", slice: [21, 30], taskRange: "20-28" },
  { key: "vocabulary", icon: "🔤", title: "Словообразование", slice: [30, 36], taskRange: "29-34" },
  { key: "writing", icon: "✍️", title: "Письмо", slice: [36, 37], taskRange: "-" },
];

const WRITTEN_SCORE_COL = 46;
const WRITTEN_PERCENT_COL = 47;
const PART1_SCORE_COL = 42;
const PART1_PERCENT_COL = 43;
const PART2_SCORE_COL = 44;
const PART2_PERCENT_COL = 45;
const EXCLUDED_STUDENT_KEYS = new Set(["дугинец", "выступец_дарья"]);
const TASK_TOPIC_MAP = {
  12: "Чтение: сопоставление текстов и вопросов",
  13: "Чтение: True / False / Not stated",
  14: "Чтение: True / False / Not stated",
  15: "Чтение: True / False / Not stated",
  16: "Чтение: True / False / Not stated",
  17: "Чтение: True / False / Not stated",
  18: "Чтение: True / False / Not stated",
  19: "Чтение: True / False / Not stated",
  20: "Грамматика: Past Simple / степени сравнения / множественное число",
  21: "Грамматика: Past Simple / отрицательные формы / Past Continuous",
  22: "Грамматика: Passive Voice / степени сравнения / Past Simple",
  23: "Грамматика: Past Simple / нестандартное множественное число / отрицание",
  24: "Грамматика: Past Simple / степени сравнения / отрицательные формы",
  25: "Грамматика: Present Perfect / местоимения / Past Simple",
  26: "Грамматика: порядковые числительные / местоимения / отрицательные формы",
  27: "Грамматика: Past Perfect / Past Simple / степени сравнения",
  28: "Грамматика: Present Perfect / нестандартное множественное число",
  29: "Словообразование: существительные (-tion / -ance / -ment / -er)",
  30: "Словообразование: прилагательные (-ous / -ful / -al / -ive / -able)",
  31: "Словообразование: существительные (-er / -or / -ist / -ness / -ion)",
  32: "Словообразование: прилагательные (-able / -ful / -ous / -ive / -ing / -ed)",
  33: "Словообразование: отрицательные префиксы (un- / im- / in-)",
  34: "Словообразование: отрицательные префиксы (un- / im- / in- / dis- / ir-)",
};
const BOOST_TOPIC_MAP = {
  20: "past simple, comparison, plural forms",
  21: "past simple, negatives, past continuous",
  22: "passive voice, comparison, past simple",
  23: "past simple, irregular plurals, negatives",
  24: "past simple, comparison, negatives",
  25: "present perfect, pronouns, past simple",
  26: "ordinal numerals, pronouns, negatives",
  27: "past perfect, past simple, comparison",
  28: "present perfect, irregular plurals",
  29: "noun suffixes: -tion, -ance, -ment, -er",
  30: "adjective suffixes: -ous, -ful, -al, -ive, -able",
  31: "noun suffixes: -er, -or, -ist, -ness, -ion",
  32: "adjective suffixes: -able, -ful, -ous, -ive, -ing, -ed",
  33: "negative prefixes: un-, im-, in-",
  34: "negative prefixes: un-, im-, in-, dis-, ir-",
};

const inputPath = resolveInputPath(cliFilePath);
const outputDir = path.join(rootDir, "public");
const outputPath = path.join(outputDir, "report-data.json");

const data = buildReportData(inputPath);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
console.log(`Generated ${path.relative(rootDir, outputPath)} with ${data.reports.length} students`);

function buildReportData(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheetNames = workbook.SheetNames.filter((name) => !name.toLowerCase().startsWith("шаблон")).reverse();
  const students = new Map();

  for (const sheetName of sheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      defval: "",
    });
    const maximums = rows[4] || [];
    let prevNum = null;
    let groupIndex = 1;

    for (let rowIndex = 5; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const rawNum = numeric(row[0]);
      const rawName = stringValue(row[1]);
      if (!rawName) continue;
      if (rawName.toLowerCase().includes("среднее значение")) break;
      if (prevNum !== null && rawNum < prevNum && rawNum <= 2) groupIndex += 1;
      prevNum = rawNum;

      const hasAttemptData = row.slice(2, 37).some((value) => stringValue(value) !== "");
      const fullName = rawName.trim();
      const studentKey = normalizeName(fullName);
      if (isExcludedStudent(studentKey, fullName)) continue;
      const groupName = `9.${groupIndex}`;

      const student = students.get(studentKey) || {
        studentKey,
        fullName,
        groupName,
        attempts: new Map(),
      };

      if (hasAttemptData) {
        const sections = Object.fromEntries(
          SECTION_CONFIG.map((section) => {
            const maxScore = sumRange(maximums, section.slice[0], section.slice[1]);
            const score = sumRange(row, section.slice[0], section.slice[1]);
            return [section.key, maxScore > 0 ? round((score / maxScore) * 100, 1) : 0];
          }),
        );

        student.attempts.set(sheetName, {
          sheetName,
          label: sheetName.trim(),
          shortLabel: shortLabel(sheetName),
          monthLabel: monthLabel(sheetName),
          isExam: sheetName.includes("ЭКЗАМЕН"),
          variantNumber: extractVariantNumber(sheetName),
          taskPercents: buildTaskPercents(row, maximums),
          hasData: true,
          part1Score: numeric(row[PART1_SCORE_COL]),
          part1Percent: numeric(row[PART1_PERCENT_COL]),
          part2Score: numeric(row[PART2_SCORE_COL]),
          part2Percent: numeric(row[PART2_PERCENT_COL]),
          totalScore: numeric(row[WRITTEN_SCORE_COL]),
          totalPercent: numeric(row[WRITTEN_PERCENT_COL]),
          listeningPercent: sections.listening,
          readingPercent: sections.reading,
          grammarPercent: sections.grammar,
          vocabularyPercent: sections.vocabulary,
          writingPercent: sections.writing,
        });
      }

      students.set(studentKey, student);
    }
  }

  const orderedStudents = Array.from(students.values()).sort((a, b) => {
    return a.groupName.localeCompare(b.groupName, "ru") || a.fullName.localeCompare(b.fullName, "ru");
  });

  const reports = orderedStudents.map((student, index) => {
    const [colorA, colorB] = PALETTE[index % PALETTE.length];
    const tests = sheetNames.map((sheetName) => {
      const existing = student.attempts.get(sheetName);
      if (existing) {
        return decorateTest(existing);
      }
      return decorateTest({
        sheetName,
        label: sheetName.trim(),
        shortLabel: shortLabel(sheetName),
        monthLabel: monthLabel(sheetName),
        isExam: sheetName.includes("ЭКЗАМЕН"),
        hasData: false,
        part1Score: 0,
        part1Percent: 0,
        part2Score: 0,
        part2Percent: 0,
        totalScore: 0,
        totalPercent: 0,
        listeningPercent: 0,
        readingPercent: 0,
        grammarPercent: 0,
        vocabularyPercent: 0,
        writingPercent: 0,
      });
    });

    const filledTests = tests.filter((test) => test.hasData);
    const latest = filledTests[filledTests.length - 1];
    const percents = filledTests.map((test) => test.totalPercent);
    const averagePercent = averageOf(percents);
    const bestPercent = percents.length ? Math.max(...percents) : 0;
    const firstPercent = filledTests[0]?.totalPercent || 0;
    const trendDelta = latest ? latest.totalPercent - firstPercent : 0;
    const trendText = buildTrendText(firstPercent, latest?.totalPercent || 0);
    const trendLabel = buildTrendLabel(trendDelta);
    const sectionAverages = SECTION_CONFIG.map((section) => {
      const avg = averageOf(filledTests.map((test) => test[`${section.key}Percent`]));
      return {
        key: section.key,
        icon: section.icon,
        title: section.title,
        taskRange: section.taskRange,
        averagePercent: round(avg, 1),
        levelLabel: levelLabel(avg),
        tone: tone(avg),
        color: toneColor(avg),
      };
    });
    const variantInsights = analyzeVariantInsights(filledTests);
    const boosts = buildBoosts(filledTests);
    const strengths = buildStrengths(sectionAverages);
    const growthAreas = buildGrowthAreas(sectionAverages, percents, variantInsights);
    const recommendation = buildRecommendation(sectionAverages, variantInsights);
    const monthlyBars = buildMonthlyBars(filledTests);

    return {
      id: student.studentKey,
      studentKey: student.studentKey,
      fullName: student.fullName,
      shortName: student.fullName.split(" ")[0],
      groupName: student.groupName,
      colorA,
      colorB,
      latestScore: latest?.totalScore || 0,
      latestPercent: round(latest?.totalPercent || 0, 1),
      averagePercent: round(averagePercent, 1),
      bestPercent: round(bestPercent, 1),
      testsCount: filledTests.length,
      trendDelta: round(trendDelta, 1),
      trendText,
      trendLabel,
      trendTone: tone(latest?.totalPercent || 0),
      strengths,
      growthAreas,
      recommendation,
      boosts,
      sections: sectionAverages,
      tests,
      monthlyBars,
    };
  });

  const groups = Array.from(new Set(reports.map((report) => report.groupName)))
    .sort((a, b) => a.localeCompare(b, "ru"))
    .map((groupName, index) => ({
      groupName,
      color: reports.find((report) => report.groupName === groupName)?.colorB || PALETTE[index % PALETTE.length][1],
      students: reports
        .filter((report) => report.groupName === groupName)
        .map((report) => ({
          studentKey: report.studentKey,
          shortName: report.shortName,
          color: report.colorB,
        })),
    }))
    .filter((group) => group.students.length > 0);

  return {
    generatedAt: new Date().toISOString(),
    groups,
    reports,
  };
}

function decorateTest(test) {
  return {
    ...test,
    tone: tone(test.totalPercent),
    levelLabel: levelLabel(test.totalPercent),
  };
}

function buildMonthlyBars(tests) {
  const grouped = new Map();
  for (const test of tests) {
    const bucket = grouped.get(test.monthLabel) || [];
    bucket.push(test.totalPercent);
    grouped.set(test.monthLabel, bucket);
  }
  return Array.from(grouped.entries()).map(([label, values]) => ({
    label,
    percent: round(averageOf(values), 1),
    tone: tone(averageOf(values)),
    color: toneColor(averageOf(values)),
    isExam: label === "ЭКЗ",
  }));
}

function buildStrengths(sections) {
  const strong = sections.filter((section) => section.averagePercent >= 85);
  if (strong.length > 0) {
    return strong.map((section) => `${section.title} ${section.averagePercent.toFixed(1)}%`);
  }
  const best = [...sections].sort((a, b) => b.averagePercent - a.averagePercent)[0];
  return [`Лучший раздел: ${best.title} ${best.averagePercent.toFixed(1)}%`];
}

function buildGrowthAreas(sections, percents, variantInsights = emptyVariantInsights()) {
  const items = [];
  sections.filter((s) => s.averagePercent < 70).forEach((s) => items.push(buildGrowthLine(s, "critical")));
  sections
    .filter((s) => s.averagePercent >= 70 && s.averagePercent < 85)
    .forEach((s) => items.push(buildGrowthLine(s, "unstable")));
  if (items.length === 0) {
    const weakest = [...sections].sort((a, b) => a.averagePercent - b.averagePercent)[0];
    items.push(buildGrowthLine(weakest, "potential"));
  }
  if (percents.length > 1) {
    const spread = Math.max(...percents) - Math.min(...percents);
    if (spread >= 20) items.push(`Разброс ${Math.round(spread)}% между тестами`);
  }
  return dedupeLines([...items, ...variantInsights.growthAreas]);
}

function buildRecommendation(sections, variantInsights = emptyVariantInsights()) {
  if (variantInsights.recommendations.length > 0) {
    return variantInsights.recommendations.slice(0, 3).join(" ");
  }

  return dedupeLines([
    ...variantInsights.recommendations,
    ...[...sections]
      .sort((a, b) => a.averagePercent - b.averagePercent)
      .slice(0, 2)
      .map((section) => recommendationFor(section.key)),
  ])
    .slice(0, 3)
    .join(" ");
}

function buildTrendText(firstPercent, latestPercent) {
  const delta = latestPercent - firstPercent;
  const warning = delta <= -10 ? `, ⚠${Math.round(delta)}%` : "";
  return `${Math.round(firstPercent)}% → ${Math.round(latestPercent)}%${warning}`;
}

function buildTrendLabel(delta) {
  if (delta >= 10) return `↑ +${Math.round(delta)}%`;
  if (delta <= -10) return `↓ ${Math.round(delta)}%`;
  return "→ ровно";
}

function recommendationFor(sectionKey) {
  switch (sectionKey) {
    case "listening":
      return "Добавить короткие аудирования 3 раза в неделю и разбор ловушек по ключевым словам.";
    case "reading":
      return "Тренировать поиск фактов и matching с лимитом по времени на каждый текст.";
    case "grammar":
      return "Грамматика: сначала отработать Past Simple и неправильные глаголы, затем степени сравнения, Present/Past Perfect, Passive Voice, нестандартное множественное число и отрицательные формы.";
    case "vocabulary":
      return "Словообразование: закрепить существительные на -tion/-ance/-ment/-er, прилагательные на -ous/-ful/-al/-ive/-able и отрицательные префиксы un-/im-/in-/dis-.";
    case "writing":
      return "Раз в неделю писать письмо по шаблону и отдельно проверять критерии 2 части.";
    default:
      return "Сделать серию коротких тренировок по слабому разделу.";
  }
}

function buildGrowthLine(section, mode) {
  const prefix = mode === "critical" ? "Критично" : mode === "unstable" ? "Нестабильно" : "Потенциал роста";
  const score = `${Math.round(section.averagePercent)}%`;

  switch (section.key) {
    case "grammar":
      return `${prefix}: ${section.title} ${score} — проверить Past Simple, степени сравнения, Perfect и Passive Voice.`;
    case "vocabulary":
      return `${prefix}: ${section.title} ${score} — проверить суффиксы существительных/прилагательных и отрицательные префиксы.`;
    case "writing":
      return `${prefix}: ${section.title} ${score} — письмо по шаблону, логика ответа и критерии части 2.`;
    default:
      return `${prefix}: ${section.title} ${score}`;
  }
}

function extractVariantNumber(sheetName) {
  const match = sheetName.match(/(?:^|\s)(\d+)\s*TEST\b/i);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function buildTaskPercents(row, maximums) {
  const taskPercents = {};
  for (let taskNumber = 12; taskNumber <= 34; taskNumber += 1) {
    const columnIndex = taskNumber + 1;
    const rawValue = stringValue(row[columnIndex]);
    const maxScore = numeric(maximums[columnIndex]);
    if (!rawValue || maxScore <= 0) {
      taskPercents[taskNumber] = null;
      continue;
    }
    const score = numeric(row[columnIndex]);
    taskPercents[taskNumber] = round((score / maxScore) * 100, 1);
  }
  return taskPercents;
}

function emptyVariantInsights() {
  return { growthAreas: [], recommendations: [] };
}

function buildBoosts(tests) {
  const topicStats = new Map();

  for (const test of tests) {
    if (!test.taskPercents) {
      continue;
    }

    for (let taskNumber = 20; taskNumber <= 34; taskNumber += 1) {
      const percent = test.taskPercents[taskNumber];
      if (percent === null || percent === undefined) {
        continue;
      }

      const topic = BOOST_TOPIC_MAP[taskNumber];
      if (!topic) {
        continue;
      }

      const sectionKey = taskNumber <= 28 ? "grammar" : "vocabulary";
      const stat = topicStats.get(topic) || { sectionKey, totalPercent: 0, count: 0 };
      stat.totalPercent += percent;
      stat.count += 1;
      topicStats.set(topic, stat);
    }
  }

  const ranked = [...topicStats.entries()]
    .map(([topic, stat]) => ({
      topic,
      sectionKey: stat.sectionKey,
      averagePercent: stat.count > 0 ? round(stat.totalPercent / stat.count, 1) : 0,
    }))
    .filter((item) => item.averagePercent < 100)
    .sort((left, right) => left.averagePercent - right.averagePercent || left.topic.localeCompare(right.topic, "en"))
    .slice(0, 4);

  let grammarIndex = 0;
  let vocabularyIndex = 0;

  return ranked.map((item) => {
    if (item.sectionKey === "grammar") {
      grammarIndex += 1;
      return {
        title: `Grammar Boost ${grammarIndex}`,
        topics: item.topic,
        percentCorrect: item.averagePercent,
      };
    }

    vocabularyIndex += 1;
    return {
      title: `Word Formation Boost ${vocabularyIndex}`,
      topics: item.topic,
      percentCorrect: item.averagePercent,
    };
  });
}

function analyzeVariantInsights(tests) {
  const solvedVariants = tests.filter((test) => test.variantNumber > 0 && test.taskPercents);
  if (solvedVariants.length === 0) {
    return emptyVariantInsights();
  }

  const readingTask12 = { variants: new Set(), deficit: 0, hits: 0 };
  const readingTfns = { variants: new Set(), deficit: 0, hits: 0 };
  const topicStats = new Map();

  for (const test of solvedVariants) {
    const reading12Percent = test.taskPercents[12];
    if (reading12Percent !== null && reading12Percent < 100) {
      readingTask12.variants.add(test.variantNumber);
      readingTask12.deficit += 100 - reading12Percent;
      readingTask12.hits += 1;
    }

    for (let taskNumber = 13; taskNumber <= 19; taskNumber += 1) {
      const percent = test.taskPercents[taskNumber];
      if (percent !== null && percent < 100) {
        readingTfns.variants.add(test.variantNumber);
        readingTfns.deficit += 100 - percent;
        readingTfns.hits += 1;
      }
    }

    for (let taskNumber = 20; taskNumber <= 34; taskNumber += 1) {
      const percent = test.taskPercents[taskNumber];
      if (percent === null || percent >= 100) {
        continue;
      }
      const topic = TASK_TOPIC_MAP[taskNumber];
      if (!topic) {
        continue;
      }
      const stats = topicStats.get(topic) || { variants: new Set(), deficit: 0, hits: 0 };
      stats.variants.add(test.variantNumber);
      stats.deficit += 100 - percent;
      stats.hits += 1;
      topicStats.set(topic, stats);
    }
  }

  const growthAreas = [];
  const recommendations = [];

  if (readingTask12.hits > 0) {
    growthAreas.push(`Варианты ${formatVariantList(readingTask12.variants)}: чтение, задание 12 — сопоставление текстов и вопросов.`);
    recommendations.push("По вариантам сборника отдельно тренировать чтение задания 12: быстрое сопоставление вопросов с фрагментами текста.");
  }

  if (readingTfns.hits > 0) {
    growthAreas.push(`Варианты ${formatVariantList(readingTfns.variants)}: чтение, задания 13-19 — True / False / Not stated.`);
    recommendations.push("По вариантам сборника отдельно тренировать чтение заданий 13-19: факты против домыслов и точные формулировки True / False / Not stated.");
  }

  const rankedTopics = [...topicStats.entries()].sort((left, right) => {
    const deficitDiff = right[1].deficit - left[1].deficit;
    if (deficitDiff !== 0) {
      return deficitDiff;
    }
    const hitDiff = right[1].hits - left[1].hits;
    if (hitDiff !== 0) {
      return hitDiff;
    }
    return left[0].localeCompare(right[0], "ru");
  });

  for (const [topic, stats] of rankedTopics.slice(0, 4)) {
    growthAreas.push(`Варианты ${formatVariantList(stats.variants)}: ${topic}.`);
    recommendations.push(`По вариантам сборника повторить тему: ${topic}.`);
  }

  return {
    growthAreas: dedupeLines(growthAreas),
    recommendations: dedupeLines(recommendations),
  };
}

function formatVariantList(variantsSet) {
  return [...variantsSet].sort((left, right) => left - right).join(", ");
}

function dedupeLines(items) {
  return [...new Set(items.filter(Boolean))];
}

function levelLabel(value) {
  if (value >= 85) return "Отлично";
  if (value >= 70) return "Хорошо";
  if (value >= 55) return "Средне";
  return "Слабо";
}

function tone(value) {
  if (value >= 85) return "great";
  if (value >= 70) return "good";
  if (value >= 55) return "warn";
  return "bad";
}

function toneColor(value) {
  if (value >= 85) return "#276749";
  if (value >= 70) return "#2b6cb0";
  if (value >= 55) return "#d69e2e";
  return "#e53e3e";
}

function monthLabel(label) {
  if (label.includes("30.10")) return "Окт";
  if (label.includes("29.11")) return "Ноя";
  if (label.includes("14.01") || label.includes("21.01") || label.includes("26-30.01")) return "Янв";
  if (["7.02", "2-6.02", "9-13.02", "16-20.02", "23-28.02"].some((part) => label.includes(part))) return "Фев";
  if (label.includes("02-08.03") || label.includes("09-15.0.3")) return "Мар";
  if (label.includes("ЭКЗАМЕН")) return "ЭКЗ";
  return shortLabel(label);
}

function shortLabel(label) {
  return label
    .replace(/^(\d+\s+TEST\s+)/i, "")
    .replace("ЭКЗАМЕН (отработка)", "ЭКЗ отраб.")
    .replace("ЭКЗАМЕН", "ЭКЗ")
    .replace("отработка ", "")
    .trim();
}

function normalizeName(value) {
  return value
    .trim()
    .toLowerCase()
    .split("(")[0]
    .trim()
    .replace(/[ё]/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function isExcludedStudent(studentKey, fullName) {
  const normalizedFullName = fullName.toLowerCase().replace(/[ё]/g, "е");
  return (
    EXCLUDED_STUDENT_KEYS.has(studentKey) ||
    normalizedFullName.includes("дугинец") ||
    normalizedFullName.includes("выступец дарья")
  );
}

function sumRange(row, start, end) {
  let sum = 0;
  for (let index = start; index < end; index += 1) sum += numeric(row[index]);
  return sum;
}

function averageOf(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function numeric(value) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value) {
  return String(value || "").trim();
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function resolveInputPath(overridePath) {
  if (overridePath) {
    return resolvePathOrLatestXlsx(path.resolve(rootDir, overridePath));
  }

  const configured = process.env.PB_XLSX_FILE ? path.resolve(rootDir, process.env.PB_XLSX_FILE) : "";
  if (configured && fs.existsSync(configured)) {
    return configured;
  }

  const latestRootFile = getLatestXlsxFromDir(rootDir);
  if (latestRootFile) {
    return latestRootFile;
  }

  return path.resolve(rootDir, "./Англ 9 Север-2.xlsx");
}

function getCliOptionValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    return "";
  }

  return process.argv[index + 1];
}

function resolvePathOrLatestXlsx(targetPath) {
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    const latest = getLatestXlsxFromDir(targetPath);
    if (latest) {
      return latest;
    }
    throw new Error(`No .xlsx files found in directory: ${targetPath}`);
  }

  return targetPath;
}

function getLatestXlsxFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return "";
  }

  const files = fs
    .readdirSync(dirPath)
    .filter((name) => /\.xlsx?$/i.test(name))
    .map((name) => {
      const fullPath = path.join(dirPath, name);
      return {
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return files[0]?.fullPath || "";
}
