/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const variants = new Collection({
    type: "base",
    name: "oge_grammar_variants",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "variantNumber", type: "number", required: true, unique: true },
      { name: "year", type: "number", required: true },
      { name: "section", type: "text", required: true },
      { name: "sourceTitle", type: "text", required: true },
      { name: "sourceFile", type: "text", required: true },
      { name: "answersSourceFile", type: "text", required: true },
      { name: "pageNumber", type: "number", required: true },
      { name: "tasksCount", type: "number", required: true },
      { name: "contentText", type: "text" },
    ],
  });

  const tasks = new Collection({
    type: "base",
    name: "oge_grammar_tasks",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "taskKey", type: "text", required: true, unique: true },
      { name: "variantNumber", type: "number", required: true },
      { name: "taskNumber", type: "number", required: true },
      { name: "orderIndex", type: "number", required: true },
      { name: "year", type: "number", required: true },
      { name: "section", type: "text", required: true },
      { name: "topic", type: "text", required: true },
      { name: "cueWord", type: "text", required: true },
      { name: "promptText", type: "text", required: true },
      { name: "answer", type: "text", required: true },
      { name: "sourceFile", type: "text", required: true },
      { name: "answersSourceFile", type: "text", required: true },
    ],
  });

  app.save(variants);
  app.save(tasks);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("oge_grammar_tasks"));
  app.delete(app.findCollectionByNameOrId("oge_grammar_variants"));
});
