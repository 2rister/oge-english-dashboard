/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const variants = app.findCollectionByNameOrId("oge_variants");

  variants.fields.add(
    new TextField({ name: "contentPart1", max: 0 }),
    new TextField({ name: "contentPart2", max: 0 }),
    new TextField({ name: "contentPart3", max: 0 }),
  );

  app.save(variants);
}, (app) => {
  const variants = app.findCollectionByNameOrId("oge_variants");

  variants.fields.removeByName("contentPart1");
  variants.fields.removeByName("contentPart2");
  variants.fields.removeByName("contentPart3");

  app.save(variants);
});
