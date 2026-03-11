/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const boosts = new Collection({
    type: "base",
    name: "student_grammar_boosts",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "boostKey", type: "text", required: true, unique: true },
      { name: "studentKey", type: "text", required: true },
      { name: "fullName", type: "text", required: true },
      { name: "groupName", type: "text", required: true },
      { name: "boostTitle", type: "text", required: true },
      { name: "durationMinutes", type: "number", required: true },
      { name: "taskCount", type: "number", required: true },
      { name: "weakTopics", type: "text" },
      { name: "tasksJson", type: "text", required: true },
      { name: "answerKeyJson", type: "text", required: true },
      { name: "answerMask", type: "text" },
      { name: "correctCount", type: "number" },
      { name: "sourceManifest", type: "text", required: true },
      { name: "status", type: "text", required: true },
    ],
  });

  app.save(boosts);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("student_grammar_boosts"));
});
