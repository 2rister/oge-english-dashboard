import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import express from "express";
import puppeteer from "puppeteer-core";
import { URL, fileURLToPath } from "node:url";
import { buildFileName, buildStandaloneHtml } from "./export-template.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const pbBaseUrl = (process.env.PB_URL || "http://127.0.0.1:8091").replace(/\/$/, "");
const EXCLUDED_STUDENT_KEYS = new Set(["дугинец", "выступец_дарья"]);
const app = express();

let browserPromise;

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/download-report", async (req, res) => {
  try {
    const format = req.query.format === "html" ? "html" : "pdf";
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const payload = await buildPayload(query);
    const html = buildStandaloneHtml(payload, { includeCover: format === "html" });

    if (format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${buildFileName("html", query)}"`);
      res.send(html);
      return;
    }

    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        },
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${buildFileName("pdf", query)}"`);
      res.send(pdf);
    } finally {
      await page.close();
    }
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Export failed" });
  }
});

app.listen(8092, "127.0.0.1", () => {
  console.log("Export API started at http://127.0.0.1:8092");
});

async function buildPayload(query) {
  const raw = await buildReportDataFromPocketBase();
  const normalized = query.trim().toLowerCase();
  const reports = normalized
    ? raw.reports.filter((item) => item.fullName.toLowerCase().includes(normalized) || item.groupName.toLowerCase().includes(normalized))
    : raw.reports;
  const keys = new Set(reports.map((item) => item.studentKey));
  const groups = raw.groups
    .map((group) => ({ ...group, students: group.students.filter((student) => keys.has(student.studentKey)) }))
    .filter((group) => group.students.length > 0);

  return {
    generatedAt: raw.generatedAt,
    reports,
    groups,
    query,
  };
}

async function buildReportDataFromPocketBase() {
  const [summaries, results] = await Promise.all([
    fetchCollectionAll("student_summaries", "groupName,fullName"),
    fetchCollectionAll("student_results", "sortOrder,studentKey"),
  ]);
  const filteredSummaries = summaries.filter((summary) => !isExcludedStudent(summary.studentKey, summary.fullName));
  const visibleKeys = new Set(filteredSummaries.map((summary) => summary.studentKey));
  const filteredResults = results.filter((record) => visibleKeys.has(record.studentKey));
  const orderedTests = buildOrderedTests(filteredResults);
  const resultsMap = new Map();

  filteredResults.forEach((record) => {
    const bySheet = resultsMap.get(record.studentKey) || new Map();
    bySheet.set(normalizeSheetName(record.sheetName), record);
    resultsMap.set(record.studentKey, bySheet);
  });

  const reports = filteredSummaries.map((summary) => {
    const bySheet = resultsMap.get(summary.studentKey) || new Map();
    const tests = orderedTests.map((testMeta) => {
      const record = bySheet.get(normalizeSheetName(testMeta.sheetName));
      const totalPercent = record?.writtenPercent || 0;
      return {
        sheetName: testMeta.sheetName,
        label: testMeta.label,
        shortLabel: shortLabel(testMeta.label),
        monthLabel: monthLabel(testMeta.label),
        isExam: testMeta.isExam,
        hasData: Boolean(record),
        part1Score: record?.part1Score || 0,
        part1Percent: record?.part1Percent || 0,
        part2Score: record?.part2Score || 0,
        part2Percent: record?.part2Percent || 0,
        totalScore: record?.writtenScore || 0,
        totalPercent,
        tone: tone(totalPercent),
        levelLabel: levelLabel(totalPercent),
      };
    });

    const sections = [
      { key: "listening", icon: "🎧", title: "Аудирование", taskRange: "1-11", averagePercent: summary.sectionListening },
      { key: "reading", icon: "📖", title: "Чтение", taskRange: "12-19", averagePercent: summary.sectionReading },
      { key: "grammar", icon: "✏️", title: "Грамматика", taskRange: "20-28", averagePercent: summary.sectionGrammar },
      { key: "vocabulary", icon: "🔤", title: "Словообразование", taskRange: "29-34", averagePercent: summary.sectionVocabulary },
      { key: "writing", icon: "✍️", title: "Письмо", taskRange: "-", averagePercent: summary.sectionWriting },
    ].map((section) => ({
      ...section,
      levelLabel: levelLabel(section.averagePercent),
      tone: tone(section.averagePercent),
      color: toneColor(section.averagePercent),
    }));

    return {
      id: summary.id,
      studentKey: summary.studentKey,
      fullName: summary.fullName,
      shortName: summary.fullName.split(" ")[0],
      groupName: summary.groupName,
      colorA: summary.colorA,
      colorB: summary.colorB,
      latestScore: summary.latestScore,
      latestPercent: summary.latestPercent,
      averagePercent: summary.averagePercent,
      bestPercent: summary.bestPercent,
      testsCount: summary.testsCount,
      trendDelta: summary.trendDelta,
      trendText: summary.trendText,
      trendLabel: buildTrendLabel(summary.trendDelta),
      trendTone: tone(summary.latestPercent),
      strengths: splitLines(summary.strengths),
      growthAreas: splitLines(summary.growthAreas),
      recommendation: summary.recommendation,
      boosts: parseBoosts(summary.boostsJson),
      sections,
      tests,
      monthlyBars: buildMonthlyBars(tests.filter((test) => test.hasData)),
    };
  });

  const groups = Array.from(new Set(reports.map((report) => report.groupName)))
    .sort((a, b) => a.localeCompare(b, "ru"))
    .map((groupName, index) => ({
      groupName,
      color: reports.find((report) => report.groupName === groupName)?.colorB || fallbackGroupColor(index),
      students: reports
        .filter((report) => report.groupName === groupName)
        .map((report) => ({
          studentKey: report.studentKey,
          shortName: report.shortName,
          color: report.colorB,
        })),
    }));

  return {
    generatedAt: new Date().toISOString(),
    reports,
    groups,
  };
}

async function getBrowser() {
  const executablePath = resolveChromePath();
  if (!executablePath) {
    throw new Error("Chrome or Chromium not found. Set CHROME_PATH if needed.");
  }

  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }

  return browserPromise;
}

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

async function fetchCollectionAll(collection, sort) {
  const items = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const url = new URL(`${pbBaseUrl}/api/collections/${collection}/records`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("perPage", String(perPage));
    url.searchParams.set("sort", sort);
    const response = await requestJson(url);
    items.push(...response.items);
    if (response.page >= response.totalPages || response.items.length === 0) {
      break;
    }
    page += 1;
  }

  return items;
}

async function requestJson(url) {
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
            reject(new Error(`PocketBase ${response.statusCode}: ${raw}`));
            return;
          }

          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

function buildOrderedTests(resultRecords) {
  const tests = new Map();
  resultRecords.forEach((record) => {
    const key = normalizeSheetName(record.sheetName);
    const existing = tests.get(key);
    if (!existing || record.sortOrder > existing.sortOrder) {
      tests.set(key, {
        sheetName: record.sheetName,
        label: record.label || record.sheetName,
        sortOrder: record.sortOrder,
        isExam: record.sheetName.includes("ЭКЗАМЕН"),
      });
    }
  });
  return Array.from(tests.values()).sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "ru"));
}

function buildMonthlyBars(tests) {
  const grouped = new Map();
  tests.forEach((test) => {
    const values = grouped.get(test.monthLabel) || [];
    values.push(test.totalPercent);
    grouped.set(test.monthLabel, values);
  });

  return Array.from(grouped.entries()).map(([label, values]) => {
    const percent = round(average(values), 1);
    return {
      label,
      percent,
      tone: tone(percent),
      color: toneColor(percent),
      isExam: label === "ЭКЗ",
    };
  });
}

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoosts(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        title: String(item.title || "").trim(),
        topics: String(item.topics || "").trim(),
        percentCorrect: Number(item.percentCorrect || 0),
      }))
      .filter((item) => item.title && item.topics);
  } catch {
    return [];
  }
}

function normalizeSheetName(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function shortLabel(label) {
  return label
    .replace(/^(\d+\s+TEST\s+)/i, "")
    .replace("ЭКЗАМЕН (отработка)", "ЭКЗ отраб.")
    .replace("ЭКЗАМЕН", "ЭКЗ")
    .replace("отработка ", "")
    .trim();
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

function buildTrendLabel(delta) {
  if (delta >= 10) return `↑ +${Math.round(delta)}%`;
  if (delta <= -10) return `↓ ${Math.round(delta)}%`;
  return "→ ровно";
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

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function fallbackGroupColor(index) {
  const colors = ["#276749", "#2b6cb0", "#6b46c1", "#dd6b20", "#0987a0", "#c53030"];
  return colors[index % colors.length];
}

function normalizeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function isExcludedStudent(studentKey, fullName) {
  return EXCLUDED_STUDENT_KEYS.has(studentKey) || EXCLUDED_STUDENT_KEYS.has(normalizeName(fullName));
}
