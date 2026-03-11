import type { StudentReport, StudentSummary, TestResult, SectionAverage } from "../types";
import { SECTION_META } from "../constants";

const baseUrl = (import.meta.env.VITE_PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");

type PocketBaseList<T> = {
  items: T[];
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
  writtenScore: number;
  writtenPercent: number;
  listeningPercent: number;
  readingPercent: number;
  grammarPercent: number;
  vocabularyPercent: number;
  writingPercent: number;
};

async function fetchCollection<T>(collection: string, query = ""): Promise<T[]> {
  const response = await fetch(`${baseUrl}/api/collections/${collection}/records${query}`);
  if (!response.ok) {
    throw new Error(`PocketBase error ${response.status} for ${collection}`);
  }

  const data = (await response.json()) as PocketBaseList<T>;
  return data.items;
}

export async function loadReports(): Promise<StudentReport[]> {
  const [summaryRecords, resultRecords] = await Promise.all([
    fetchCollection<SummaryRecord>("student_summaries", "?perPage=200&sort=groupName,fullName"),
    fetchCollection<ResultRecord>("student_results", "?perPage=1000&sort=studentKey,sortOrder"),
  ]);

  const resultsMap = new Map<string, TestResult[]>();

  resultRecords.forEach((record) => {
    const tests = resultsMap.get(record.studentKey) ?? [];
    tests.push(record);
    resultsMap.set(record.studentKey, tests);
  });

  return summaryRecords.map((record) => {
    const sections: SectionAverage[] = [
      { ...SECTION_META[0], averagePercent: record.sectionListening },
      { ...SECTION_META[1], averagePercent: record.sectionReading },
      { ...SECTION_META[2], averagePercent: record.sectionGrammar },
      { ...SECTION_META[3], averagePercent: record.sectionVocabulary },
      { ...SECTION_META[4], averagePercent: record.sectionWriting },
    ];

    return {
      id: record.id,
      studentKey: record.studentKey,
      fullName: record.fullName,
      groupName: record.groupName,
      latestScore: record.latestScore,
      latestPercent: record.latestPercent,
      averagePercent: record.averagePercent,
      bestPercent: record.bestPercent,
      trendDelta: record.trendDelta,
      testsCount: record.testsCount,
      colorA: record.colorA,
      colorB: record.colorB,
      strengths: splitMultiline(record.strengths),
      growthAreas: splitMultiline(record.growthAreas),
      trendText: record.trendText,
      recommendation: record.recommendation,
      sections,
      tests: resultsMap.get(record.studentKey) ?? [],
    };
  });
}

function splitMultiline(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}
