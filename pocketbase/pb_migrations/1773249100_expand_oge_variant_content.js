/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const variants = app.findCollectionByNameOrId("oge_variants");
  const contentText = variants.fields.getByName("contentText");

  contentText.max = 0;

  app.save(variants);
}, (app) => {
  const variants = app.findCollectionByNameOrId("oge_variants");
  const contentText = variants.fields.getByName("contentText");

  contentText.max = 5000;

  app.save(variants);
});
