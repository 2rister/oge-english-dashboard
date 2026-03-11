export type MetricTone = "great" | "good" | "warn" | "bad";

export type StudentSummary = {
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
};

export type TestResult = {
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

export type SectionAverage = {
  key: "listening" | "reading" | "grammar" | "vocabulary" | "writing";
  title: string;
  taskRange: string;
  averagePercent: number;
};

export type StudentReport = StudentSummary & {
  tests: TestResult[];
  sections: SectionAverage[];
  strengths: string[];
  growthAreas: string[];
  trendText: string;
  recommendation: string;
};
