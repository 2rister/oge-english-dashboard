import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

const XLSX = xlsx;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

loadEnv(path.join(rootDir, ".env"));
const cliFilePath = getCliOptionValue("--file");

const PB_URL = stripTrailingSlash(process.env.PB_URL || "http://127.0.0.1:8090");
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "";
const PB_XLSX_FILE = resolveInputPath(cliFilePath);
const DRY_RUN = process.argv.includes("--dry-run");

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
  { key: "listening", title: "Аудирование", slice: [2, 13], taskRange: "1-11" },
  { key: "reading", title: "Чтение", slice: [13, 21], taskRange: "12-19" },
  { key: "grammar", title: "Грамматика", slice: [21, 30], taskRange: "20-28" },
  { key: "vocabulary", title: "Словообразование", slice: [30, 36], taskRange: "29-34" },
  { key: "writing", title: "Письмо", slice: [36, 37], taskRange: "-" },
];

const WRITTEN_SCORE_COL = 46;
const WRITTEN_PERCENT_COL = 47;
const PART1_SCORE_COL = 42;
const PART1_PERCENT_COL = 43;
const PART2_SCORE_COL = 44;
const PART2_PERCENT_COL = 45;
const REQUIRED_COLLECTIONS = ["student_summaries", "student_results"];
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

async function main() {
  validateEnv();

  const workbook = parseWorkbook(PB_XLSX_FILE);
  const dataset = buildDataset(workbook);

  console.log(`Parsed ${dataset.summaries.length} students and ${dataset.results.length} test results from ${path.basename(PB_XLSX_FILE)}`);

  if (DRY_RUN) {
    console.log(JSON.stringify(dataset.summaries.slice(0, 3), null, 2));
    return;
  }

  let token = "";
  try {
    token = await authenticate();
  } catch (error) {
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await verifyCollections(token);
  } catch (error) {
    throw new Error(`Collection verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await replaceCollection("student_results", dataset.results, token);
  } catch (error) {
    throw new Error(`student_results import failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await replaceCollection("student_summaries", dataset.summaries, token);
  } catch (error) {
    throw new Error(`student_summaries import failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log("PocketBase import completed.");
}

function validateEnv() {
  if (!DRY_RUN && (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD)) {
    throw new Error("PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required.");
  }

  if (!fs.existsSync(PB_XLSX_FILE)) {
    throw new Error(`XLSX file not found: ${PB_XLSX_FILE}`);
  }
}

function buildDataset(workbook) {
  const sheets = workbook.sheets
    .filter((sheet) => !sheet.name.toLowerCase().startsWith("шаблон"))
    .reverse();

  const studentMap = new Map();
  let order = 0;

  sheets.forEach((sheet) => {
    const maximums = sheet.rows[4] || [];
    let prevNum = null;
    let groupIndex = 1;

    for (let rowIndex = 5; rowIndex < sheet.rows.length; rowIndex += 1) {
      const row = sheet.rows[rowIndex] || [];
      const rawNumber = numeric(row[0]);
      const rawName = stringValue(row[1]);

      if (!rawName) {
        continue;
      }

      if (rawName.toLowerCase().includes("среднее значение")) {
        break;
      }

      if (prevNum !== null && rawNumber < prevNum && rawNumber <= 2) {
        groupIndex += 1;
      }

      prevNum = rawNumber;

      const fullName = rawName.trim();
      const studentKey = normalizeName(fullName);
      if (isExcludedStudent(studentKey, fullName)) {
        continue;
      }

      const groupName = `9.${groupIndex}`;
      const hasAttemptData = row.slice(2, 37).some((value) => stringValue(value) !== "");
      if (!hasAttemptData) {
        continue;
      }

      const sectionPercents = Object.fromEntries(
        SECTION_CONFIG.map((section) => {
          const maxScore = sumRange(maximums, section.slice[0], section.slice[1]);
          const score = sumRange(row, section.slice[0], section.slice[1]);
          const percent = maxScore > 0 ? round((score / maxScore) * 100, 2) : 0;
          return [section.key, percent];
        }),
      );

      const writtenScore = numeric(row[WRITTEN_SCORE_COL]);
      const writtenPercent = numeric(row[WRITTEN_PERCENT_COL]);
      const tests = studentMap.get(studentKey)?.tests || [];

      tests.push({
        resultKey: `${studentKey}__${sheet.name}`,
        studentKey,
        fullName,
        groupName,
        sheetName: sheet.name,
        label: formatSheetLabel(sheet.name),
        sortOrder: order,
        variantNumber: extractVariantNumber(sheet.name),
        taskPercents: buildTaskPercents(row, maximums),
        part1Score: numeric(row[PART1_SCORE_COL]),
        part1Percent: numeric(row[PART1_PERCENT_COL]),
        part2Score: numeric(row[PART2_SCORE_COL]),
        part2Percent: numeric(row[PART2_PERCENT_COL]),
        writtenScore,
        writtenPercent,
        listeningPercent: sectionPercents.listening,
        readingPercent: sectionPercents.reading,
        grammarPercent: sectionPercents.grammar,
        vocabularyPercent: sectionPercents.vocabulary,
        writingPercent: sectionPercents.writing,
      });

      studentMap.set(studentKey, {
        studentKey,
        fullName,
        groupName,
        tests,
      });
    }

    order += 1;
  });

  const orderedStudents = Array.from(studentMap.values()).sort((left, right) => {
    return left.groupName.localeCompare(right.groupName, "ru") || left.fullName.localeCompare(right.fullName, "ru");
  });

  const summaries = orderedStudents.map((student, index) => {
    const palette = PALETTE[index % PALETTE.length];
    const percents = student.tests.map((test) => test.writtenPercent);
    const latest = student.tests[student.tests.length - 1];
    const average = averageOf(percents);
    const best = percents.length ? Math.max(...percents) : 0;
    const trendDelta = percents.length > 1 ? latest.writtenPercent - student.tests[0].writtenPercent : 0;
    const sections = SECTION_CONFIG.map((section) => ({
      key: section.key,
      title: section.title,
      averagePercent: averageOf(student.tests.map((test) => test[`${section.key}Percent`])),
    }));
    const variantInsights = analyzeVariantInsights(student.tests);
    const boosts = buildBoosts(student.tests);
    const strengths = buildStrengths(sections);
    const growthAreas = buildGrowthAreas(sections, percents, variantInsights);
    const recommendation = buildRecommendation(sections, variantInsights);
    const trendText = buildTrendText(student.tests);

    return {
      studentKey: student.studentKey,
      fullName: student.fullName,
      groupName: student.groupName,
      latestScore: latest?.writtenScore || 0,
      latestPercent: round(latest?.writtenPercent || 0),
      averagePercent: round(average),
      bestPercent: round(best),
      trendDelta: round(trendDelta),
      testsCount: student.tests.length,
      colorA: palette[0],
      colorB: palette[1],
      strengths: strengths.join("\n"),
      growthAreas: growthAreas.join("\n"),
      trendText,
      recommendation,
      boostsJson: JSON.stringify(boosts),
      sectionListening: round(sectionValue(sections, "listening")),
      sectionReading: round(sectionValue(sections, "reading")),
      sectionGrammar: round(sectionValue(sections, "grammar")),
      sectionVocabulary: round(sectionValue(sections, "vocabulary")),
      sectionWriting: round(sectionValue(sections, "writing")),
    };
  });

  const results = orderedStudents.flatMap((student) =>
    student.tests.map((test) => ({
      resultKey: test.resultKey,
      studentKey: test.studentKey,
      fullName: test.fullName,
      groupName: test.groupName,
      sheetName: test.sheetName,
      label: test.label,
      sortOrder: test.sortOrder,
      part1Score: test.part1Score,
      part1Percent: test.part1Percent,
      part2Score: test.part2Score,
      part2Percent: test.part2Percent,
      writtenScore: test.writtenScore,
      writtenPercent: test.writtenPercent,
      listeningPercent: test.listeningPercent,
      readingPercent: test.readingPercent,
      grammarPercent: test.grammarPercent,
      vocabularyPercent: test.vocabularyPercent,
      writingPercent: test.writingPercent,
    })),
  );

  return { summaries, results };
}

function buildStrengths(sections) {
  const strong = sections.filter((section) => section.averagePercent >= 85);
  if (strong.length > 0) {
    return strong.map((section) => `${section.title} ${Math.round(section.averagePercent)}%`);
  }

  const best = [...sections].sort((left, right) => right.averagePercent - left.averagePercent)[0];
  return [`Лучший раздел: ${best.title} ${Math.round(best.averagePercent)}%`];
}

function buildGrowthAreas(sections, percents, variantInsights = emptyVariantInsights()) {
  const items = [];
  const critical = sections.filter((section) => section.averagePercent < 70);
  const unstable = sections.filter((section) => section.averagePercent >= 70 && section.averagePercent < 85);

  critical.forEach((section) => {
    items.push(buildGrowthLine(section, "critical"));
  });

  unstable.forEach((section) => {
    items.push(buildGrowthLine(section, "unstable"));
  });

  if (items.length === 0) {
    const weakest = [...sections].sort((left, right) => left.averagePercent - right.averagePercent)[0];
    items.push(buildGrowthLine(weakest, "potential"));
  }

  if (percents.length > 1) {
    const spread = Math.max(...percents) - Math.min(...percents);
    if (spread >= 20) {
      items.push(`Разброс ${Math.round(spread)}% между тестами`);
    }
  }

  return dedupeLines([...items, ...variantInsights.growthAreas]);
}

function buildTrendText(tests) {
  if (tests.length === 0) {
    return "Нет данных";
  }

  const first = tests[0].writtenPercent;
  const last = tests[tests.length - 1].writtenPercent;
  const delta = last - first;
  const warning = delta <= -10 ? `, ⚠${Math.round(delta)}%` : "";
  return `${Math.round(first)}% → ${Math.round(last)}%${warning}`;
}

function buildRecommendation(sections, variantInsights = emptyVariantInsights()) {
  if (variantInsights.recommendations.length > 0) {
    return variantInsights.recommendations.slice(0, 3).join(" ");
  }

  const weakest = [...sections].sort((left, right) => left.averagePercent - right.averagePercent).slice(0, 2);
  const actions = [...variantInsights.recommendations, ...weakest.map((section) => recommendationFor(section.key))];
  return dedupeLines(actions).slice(0, 3).join(" ");
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
    taskPercents[taskNumber] = round((score / maxScore) * 100, 2);
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

function sectionValue(sections, key) {
  return sections.find((section) => section.key === key)?.averagePercent || 0;
}

async function authenticate() {
  const credentials = {
    identity: PB_ADMIN_EMAIL,
    password: PB_ADMIN_PASSWORD,
  };

  try {
    const response = await requestJson("/api/collections/_superusers/auth-with-password", {
      method: "POST",
      body: credentials,
    });
    return response.token;
  } catch (error) {
    const fallback = await requestJson("/api/admins/auth-with-password", {
      method: "POST",
      body: credentials,
    });
    return fallback.token;
  }
}

async function verifyCollections(token) {
  const response = await requestJson("/api/collections?perPage=200", {
    method: "GET",
    token,
  });

  const existing = new Set(response.items.map((item) => item.name));
  const missing = REQUIRED_COLLECTIONS.filter((name) => !existing.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing PocketBase collections: ${missing.join(", ")}.`);
  }
}

async function replaceCollection(collection, records, token) {
  let existing = [];
  try {
    existing = await listAll(collection, token);
  } catch (error) {
    throw new Error(`Failed to list ${collection}: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const record of existing) {
    try {
      await requestJson(`/api/collections/${collection}/records/${record.id}`, {
        method: "DELETE",
        token,
      });
    } catch (error) {
      throw new Error(`Failed to delete ${collection}/${record.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const record of records) {
    try {
      await requestJson(`/api/collections/${collection}/records`, {
        method: "POST",
        token,
        body: record,
      });
    } catch (error) {
      const identity = record.resultKey || record.studentKey || record.fullName || "unknown-record";
      throw new Error(`Failed to create ${collection}/${identity}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function listAll(collection, token) {
  const items = [];
  let page = 1;

  while (true) {
    const response = await requestJson(`/api/collections/${collection}/records?page=${page}&perPage=200`, {
      method: "GET",
      token,
    });
    items.push(...response.items);
    if (response.page >= response.totalPages || response.items.length === 0) {
      break;
    }
    page += 1;
  }

  return items;
}

function requestJson(resource, options) {
  const url = new URL(resource, PB_URL);
  const transport = url.protocol === "https:" ? https : http;
  const body = options.body ? JSON.stringify(options.body) : null;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(raw ? JSON.parse(raw) : {});
            return;
          }

          reject(new Error(`PocketBase ${response.statusCode}: ${raw}`));
        });
      },
    );

    request.on("error", reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

function parseWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  return {
    sheets: workbook.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        blankrows: false,
        defval: "",
      }),
    })),
  };
}

function normalizeName(value) {
  return value
    .trim()
    .toLowerCase()
    .split("(")[0]
    .trim()
    .replace(/[ё]/g, "е")
    .replace(/\s+/g, "-");
}

function isExcludedStudent(studentKey, fullName) {
  const normalizedFullName = fullName.toLowerCase().replace(/[ё]/g, "е");
  return (
    EXCLUDED_STUDENT_KEYS.has(studentKey) ||
    normalizedFullName.includes("дугинец") ||
    normalizedFullName.includes("выступец дарья")
  );
}

function formatSheetLabel(name) {
  return name.replace(/^(\d+\s+TEST\s+)/i, "").trim();
}

function sumRange(row, start, end) {
  let sum = 0;
  for (let index = start; index < end; index += 1) {
    sum += numeric(row[index]);
  }
  return sum;
}

function numeric(value) {
  const number = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function stringValue(value) {
  return String(value || "").trim();
}

function averageOf(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function stripTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
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

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
