export const STUDENT_PALETTE = [
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
] as const;

export const SECTION_META = [
  { key: "listening", title: "Аудирование", taskRange: "1-11" },
  { key: "reading", title: "Чтение", taskRange: "12-19" },
  { key: "grammar", title: "Грамматика", taskRange: "20-28" },
  { key: "vocabulary", title: "Словообразование", taskRange: "29-34" },
  { key: "writing", title: "Письмо", taskRange: "-" },
] as const;
