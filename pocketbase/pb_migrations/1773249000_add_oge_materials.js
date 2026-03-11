/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const variants = new Collection({
    type: "base",
    name: "oge_variants",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "variantNumber", type: "number", required: true, unique: true },
      { name: "sourceTitle", type: "text", required: true },
      { name: "sourceFile", type: "text", required: true },
      { name: "pageStart", type: "number" },
      { name: "pageEnd", type: "number" },
      { name: "pageCount", type: "number" },
      { name: "answerPageStart", type: "number" },
      { name: "answerPageEnd", type: "number" },
      { name: "contentText", type: "text" },
    ],
  });

  const answers = new Collection({
    type: "base",
    name: "oge_variant_answers",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "answerKey", type: "text", required: true, unique: true },
      { name: "variantNumber", type: "number", required: true },
      { name: "taskNumber", type: "number", required: true },
      { name: "section", type: "text", required: true },
      { name: "topic", type: "text" },
      { name: "answer", type: "text", required: true },
      { name: "sourceFile", type: "text", required: true },
    ],
  });

  app.save(variants);
  app.save(answers);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("oge_variant_answers"));
  app.delete(app.findCollectionByNameOrId("oge_variants"));
});
