export type ReportData = {
  generatedAt: string;
  groups: Array<{
    groupName: string;
    color: string;
    students: Array<{ studentKey: string; shortName: string; color: string }>;
  }>;
  reports: StudentReportData[];
};

export type StudentReportData = {
  id: string;
  studentKey: string;
  fullName: string;
  shortName: string;
  groupName: string;
  colorA: string;
  colorB: string;
  latestScore: number;
  latestPercent: number;
  averagePercent: number;
  bestPercent: number;
  testsCount: number;
  trendDelta: number;
  trendText: string;
  trendLabel: string;
  trendTone: string;
  strengths: string[];
  growthAreas: string[];
  recommendation: string;
  boosts: Array<{
    title: string;
    topics: string;
    percentCorrect: number;
  }>;
  sections: Array<{
    key: string;
    icon: string;
    title: string;
    taskRange: string;
    averagePercent: number;
    levelLabel: string;
    tone: string;
    color: string;
  }>;
  tests: Array<{
    sheetName: string;
    label: string;
    shortLabel: string;
    monthLabel: string;
    isExam: boolean;
    hasData: boolean;
    part1Score: number;
    part1Percent: number;
    part2Score: number;
    part2Percent: number;
    totalScore: number;
    totalPercent: number;
    tone: string;
    levelLabel: string;
  }>;
  monthlyBars: Array<{
    label: string;
    percent: number;
    tone: string;
    color: string;
    isExam: boolean;
  }>;
};

type PocketBaseList<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

type SummaryRecord = {
  id: string;
  studentKey: string;
  fullName: string;
  groupName: string;
  latestScore: number;
  latestPercent: number;
  averagePercent: number;
  bestPercent: number;
  trendDelta: number;
  testsCount: number;
  colorA: string;
  colorB: string;
  strengths: string;
  growthAreas: string;
  trendText: string;
  recommendation: string;
  boostsJson?: string;
  sectionListening: number;
  sectionReading: number;
  sectionGrammar: number;
  sectionVocabulary: number;
  sectionWriting: number;
};

type ResultRecord = {
  id: string;
  studentKey: string;
  sheetName: string;
  label: string;
  sortOrder: number;
  part1Score?: number;
  part1Percent?: number;
  part2Score?: number;
  part2Percent?: number;
  writtenScore: number;
  writtenPercent: number;
  listeningPercent: number;
  readingPercent: number;
  grammarPercent: number;
  vocabularyPercent: number;
  writingPercent: number;
};

const baseUrl = (import.meta.env.VITE_PB_URL || "http://127.0.0.1:8091").replace(/\/$/, "");

const SECTION_META = [
  { key: "listening", icon: "🎧", title: "Аудирование", taskRange: "1-11" },
  { key: "reading", icon: "📖", title: "Чтение", taskRange: "12-19" },
  { key: "grammar", icon: "✏️", title: "Грамматика", taskRange: "20-28" },
  { key: "vocabulary", icon: "🔤", title: "Словообразование", taskRange: "29-34" },
  { key: "writing", icon: "✍️", title: "Письмо", taskRange: "-" },
] as const;

const EXCLUDED_STUDENT_KEYS = new Set(["дугинец", "выступец_дарья"]);

async function fetchCollectionPage<T>(collection: string, params: URLSearchParams): Promise<PocketBaseList<T>> {
  const response = await fetch(`${baseUrl}/api/collections/${collection}/records?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`PocketBase error ${response.status} for ${collection}`);
  }
  return (await response.json()) as PocketBaseList<T>;
}

async function fetchCollectionAll<T>(collection: string, options: { sort?: string; filter?: string } = {}): Promise<T[]> {
  const perPage = 200;
  let page = 1;
  const items: T[] = [];

  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    });
    if (options.sort) params.set("sort", options.sort);
    if (options.filter) params.set("filter", options.filter);

    const data = await fetchCollectionPage<T>(collection, params);
    items.push(...data.items);

    if (data.page >= data.totalPages || data.items.length === 0) {
      break;
    }
    page += 1;
  }

  return items;
}

export async function loadReportData(): Promise<ReportData> {
  const [summaryRecords, resultRecords] = await Promise.all([
    fetchCollectionAll<SummaryRecord>("student_summaries", { sort: "groupName,fullName" }),
    fetchCollectionAll<ResultRecord>("student_results", { sort: "sortOrder,studentKey" }),
  ]);

  const visibleSummaryRecords = summaryRecords.filter((summary) => !isExcludedStudent(summary.studentKey, summary.fullName));
  const visibleStudentKeys = new Set(visibleSummaryRecords.map((summary) => summary.studentKey));
  const visibleResultRecords = resultRecords.filter((record) => visibleStudentKeys.has(record.studentKey));
  const orderedTests = buildOrderedTests(visibleResultRecords);

  const resultsMap = new Map<string, Map<string, ResultRecord>>();
  visibleResultRecords.forEach((record) => {
    const bySheet = resultsMap.get(record.studentKey) ?? new Map<string, ResultRecord>();
    bySheet.set(normalizeSheetName(record.sheetName), record);
    resultsMap.set(record.studentKey, bySheet);
  });

  const reports = visibleSummaryRecords.map((summary) => {
    const bySheet = resultsMap.get(summary.studentKey) ?? new Map<string, ResultRecord>();
    const tests = orderedTests.map((testMeta) => {
      const key = normalizeSheetName(testMeta.sheetName);
      const record = bySheet.get(key);
      const totalPercent = record?.writtenPercent ?? 0;
      return {
        sheetName: testMeta.sheetName,
        label: testMeta.label,
        shortLabel: shortLabel(testMeta.label),
        monthLabel: monthLabel(testMeta.label),
        isExam: testMeta.isExam,
        hasData: Boolean(record),
        part1Score: record?.part1Score ?? 0,
        part1Percent: record?.part1Percent ?? 0,
        part2Score: record?.part2Score ?? 0,
        part2Percent: record?.part2Percent ?? 0,
        totalScore: record?.writtenScore ?? 0,
        totalPercent,
        tone: tone(totalPercent),
        levelLabel: levelLabel(totalPercent),
      };
    });

    const sections = [
      { ...SECTION_META[0], averagePercent: summary.sectionListening },
      { ...SECTION_META[1], averagePercent: summary.sectionReading },
      { ...SECTION_META[2], averagePercent: summary.sectionGrammar },
      { ...SECTION_META[3], averagePercent: summary.sectionVocabulary },
      { ...SECTION_META[4], averagePercent: summary.sectionWriting },
    ].map((section) => ({
      ...section,
      levelLabel: levelLabel(section.averagePercent),
      tone: tone(section.averagePercent),
      color: toneColor(section.averagePercent),
    }));

    const monthlyBars = buildMonthlyBars(tests.filter((test) => test.hasData));

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
      monthlyBars,
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
    groups,
    reports,
  };
}

function buildOrderedTests(resultRecords: ResultRecord[]) {
  const tests = new Map<string, { sheetName: string; label: string; sortOrder: number; isExam: boolean }>();

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

  return Array.from(tests.values()).sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.label.localeCompare(right.label, "ru");
  });
}

function buildMonthlyBars(tests: StudentReportData["tests"]) {
  const grouped = new Map<string, number[]>();
  tests.forEach((test) => {
    const bucket = grouped.get(test.monthLabel) ?? [];
    bucket.push(test.totalPercent);
    grouped.set(test.monthLabel, bucket);
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

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeSheetName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function monthLabel(label: string) {
  if (label.includes("30.10")) return "Окт";
  if (label.includes("29.11")) return "Ноя";
  if (label.includes("14.01") || label.includes("21.01") || label.includes("26-30.01")) return "Янв";
  if (["7.02", "2-6.02", "9-13.02", "16-20.02", "23-28.02"].some((part) => label.includes(part))) return "Фев";
  if (label.includes("02-08.03") || label.includes("09-15.0.3")) return "Мар";
  if (label.includes("ЭКЗАМЕН")) return "ЭКЗ";
  return shortLabel(label);
}

function shortLabel(label: string) {
  return label
    .replace(/^(\d+\s+TEST\s+)/i, "")
    .replace("ЭКЗАМЕН (отработка)", "ЭКЗ отраб.")
    .replace("ЭКЗАМЕН", "ЭКЗ")
    .replace("отработка ", "")
    .trim();
}

function buildTrendLabel(delta: number) {
  if (delta >= 10) return `↑ +${Math.round(delta)}%`;
  if (delta <= -10) return `↓ ${Math.round(delta)}%`;
  return "→ ровно";
}

function levelLabel(value: number) {
  if (value >= 85) return "Отлично";
  if (value >= 70) return "Хорошо";
  if (value >= 55) return "Средне";
  return "Слабо";
}

function tone(value: number) {
  if (value >= 85) return "great";
  if (value >= 70) return "good";
  if (value >= 55) return "warn";
  return "bad";
}

function toneColor(value: number) {
  if (value >= 85) return "#276749";
  if (value >= 70) return "#2b6cb0";
  if (value >= 55) return "#d69e2e";
  return "#e53e3e";
}

function fallbackGroupColor(index: number) {
  return ["#276749", "#38a169", "#2b6cb0"][index] || "#4a5568";
}

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function parseBoosts(value?: string) {
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

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isExcludedStudent(studentKey: string, fullName: string) {
  const normalizedFullName = fullName.toLowerCase().replace(/[ё]/g, "е");
  return (
    EXCLUDED_STUDENT_KEYS.has(studentKey) ||
    normalizedFullName.includes("дугинец") ||
    normalizedFullName.includes("выступец дарья")
  );
}
