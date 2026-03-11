/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const summaries = new Collection({
    type: "base",
    name: "student_summaries",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "studentKey", type: "text", required: true, unique: true },
      { name: "fullName", type: "text", required: true },
      { name: "groupName", type: "text", required: true },
      { name: "latestScore", type: "number" },
      { name: "latestPercent", type: "number" },
      { name: "averagePercent", type: "number" },
      { name: "bestPercent", type: "number" },
      { name: "trendDelta", type: "number" },
      { name: "testsCount", type: "number" },
      { name: "colorA", type: "text" },
      { name: "colorB", type: "text" },
      { name: "strengths", type: "text" },
      { name: "growthAreas", type: "text" },
      { name: "trendText", type: "text" },
      { name: "recommendation", type: "text" },
      { name: "sectionListening", type: "number" },
      { name: "sectionReading", type: "number" },
      { name: "sectionGrammar", type: "number" },
      { name: "sectionVocabulary", type: "number" },
      { name: "sectionWriting", type: "number" },
    ],
  });

  const results = new Collection({
    type: "base",
    name: "student_results",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "resultKey", type: "text", required: true, unique: true },
      { name: "studentKey", type: "text", required: true },
      { name: "fullName", type: "text", required: true },
      { name: "groupName", type: "text", required: true },
      { name: "sheetName", type: "text", required: true },
      { name: "label", type: "text", required: true },
      { name: "sortOrder", type: "number" },
      { name: "writtenScore", type: "number" },
      { name: "writtenPercent", type: "number" },
      { name: "listeningPercent", type: "number" },
      { name: "readingPercent", type: "number" },
      { name: "grammarPercent", type: "number" },
      { name: "vocabularyPercent", type: "number" },
      { name: "writingPercent", type: "number" },
    ],
  });

  app.save(summaries);
  app.save(results);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("student_results"));
  app.delete(app.findCollectionByNameOrId("student_summaries"));
});
