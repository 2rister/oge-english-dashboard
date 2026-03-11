/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const results = app.findCollectionByNameOrId("student_results");

  results.fields.add(
    new NumberField({ name: "part1Score" }),
    new NumberField({ name: "part1Percent" }),
    new NumberField({ name: "part2Score" }),
    new NumberField({ name: "part2Percent" }),
  );

  app.save(results);
}, (app) => {
  const results = app.findCollectionByNameOrId("student_results");

  results.fields.removeByName("part1Score");
  results.fields.removeByName("part1Percent");
  results.fields.removeByName("part2Score");
  results.fields.removeByName("part2Percent");

  app.save(results);
});
