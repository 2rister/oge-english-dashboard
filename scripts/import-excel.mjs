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

const PB_URL = stripTrailingSlash(process.env.PB_URL || "http://127.0.0.1:8090");
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "";
const PB_XLSX_FILE = path.resolve(rootDir, process.env.PB_XLSX_FILE || "./Англ 9 Север-2.xlsx");
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
  { key: "grammar", title: "Грамматика", slice: [21, 29], taskRange: "20-28" },
  { key: "vocabulary", title: "Словообразование", slice: [29, 36], taskRange: "29-34" },
  { key: "writing", title: "Письмо", slice: [36, 37], taskRange: "-" },
];

const WRITTEN_SCORE_COL = 46;
const WRITTEN_PERCENT_COL = 47;
const PART1_SCORE_COL = 42;
const PART1_PERCENT_COL = 43;
const PART2_SCORE_COL = 44;
const PART2_PERCENT_COL = 45;
const REQUIRED_COLLECTIONS = ["student_summaries", "student_results"];
const EXCLUDED_STUDENT_KEYS = new Set(["дугинец", "выступец-дарья"]);

async function main() {
  validateEnv();

  const workbook = parseWorkbook(PB_XLSX_FILE);
  const dataset = buildDataset(workbook);

  console.log(`Parsed ${dataset.summaries.length} students and ${dataset.results.length} test results from ${path.basename(PB_XLSX_FILE)}`);

  if (DRY_RUN) {
    console.log(JSON.stringify(dataset.summaries.slice(0, 3), null, 2));
    return;
  }

  const token = await authenticate();
  await verifyCollections(token);
  await replaceCollection("student_results", dataset.results, token);
  await replaceCollection("student_summaries", dataset.summaries, token);

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
    const strengths = buildStrengths(sections);
    const growthAreas = buildGrowthAreas(sections, percents);
    const recommendation = buildRecommendation(sections);
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
      sectionListening: round(sectionValue(sections, "listening")),
      sectionReading: round(sectionValue(sections, "reading")),
      sectionGrammar: round(sectionValue(sections, "grammar")),
      sectionVocabulary: round(sectionValue(sections, "vocabulary")),
      sectionWriting: round(sectionValue(sections, "writing")),
    };
  });

  const results = orderedStudents.flatMap((student) => student.tests);

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

function buildGrowthAreas(sections, percents) {
  const items = [];
  const critical = sections.filter((section) => section.averagePercent < 70);
  const unstable = sections.filter((section) => section.averagePercent >= 70 && section.averagePercent < 85);

  critical.forEach((section) => {
    items.push(`Критично: ${section.title} ${Math.round(section.averagePercent)}%`);
  });

  unstable.forEach((section) => {
    items.push(`Нестабильно: ${section.title} ${Math.round(section.averagePercent)}%`);
  });

  if (items.length === 0) {
    const weakest = [...sections].sort((left, right) => left.averagePercent - right.averagePercent)[0];
    items.push(`Потенциал роста: ${weakest.title} ${Math.round(weakest.averagePercent)}%`);
  }

  if (percents.length > 1) {
    const spread = Math.max(...percents) - Math.min(...percents);
    if (spread >= 20) {
      items.push(`Разброс ${Math.round(spread)}% между тестами`);
    }
  }

  return items;
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

function buildRecommendation(sections) {
  const weakest = [...sections].sort((left, right) => left.averagePercent - right.averagePercent).slice(0, 2);
  const actions = weakest.map((section) => recommendationFor(section.key));
  return actions.join(" ");
}

function recommendationFor(sectionKey) {
  switch (sectionKey) {
    case "listening":
      return "Добавить короткие аудирования 3 раза в неделю и разбор ловушек по ключевым словам.";
    case "reading":
      return "Тренировать поиск фактов и matching с лимитом по времени на каждый текст.";
    case "grammar":
      return "Повторить грамматические паттерны 20-28 и закрепить их на мини-тестах по 10 минут.";
    case "vocabulary":
      return "Усилить словообразование: суффиксы, приставки и отрицательные формы в карточках.";
    case "writing":
      return "Раз в неделю писать письмо по шаблону и отдельно проверять критерии 2 части.";
    default:
      return "Сделать серию коротких тренировок по слабому разделу.";
  }
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
  const existing = await listAll(collection, token);

  for (const record of existing) {
    await requestJson(`/api/collections/${collection}/records/${record.id}`, {
      method: "DELETE",
      token,
    });
  }

  for (const record of records) {
    await requestJson(`/api/collections/${collection}/records`, {
      method: "POST",
      token,
      body: record,
    });
  }
}

async function listAll(collection, token) {
  const response = await requestJson(`/api/collections/${collection}/records?perPage=500`, {
    method: "GET",
    token,
  });
  return response.items;
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

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
