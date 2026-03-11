/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("student_summaries");
  collection.fields.add(
    new Field({
      system: false,
      id: "text_boosts_json",
      name: "boostsJson",
      type: "text",
      required: false,
      presentable: false,
    }),
  );
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("student_summaries");
  collection.fields.removeById("text_boosts_json");
  return app.save(collection);
});
