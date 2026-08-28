const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_CAPTION_SETTINGS,
  captionStyleForLanguage,
  normalizeCaptionSettings,
} = require("../caption-settings.js");

test("uses safe defaults and validates caption preferences", () => {
  assert.deepEqual(
    normalizeCaptionSettings({
      alignment: "invalid",
      englishColor: "red",
      portugueseColor: "#12abEF",
      englishSize: 80,
      portugueseSize: 10,
    }),
    {
      ...DEFAULT_CAPTION_SETTINGS,
      portugueseColor: "#12abef",
      englishSize: 40,
      portugueseSize: 14,
    },
  );
});

test("maps each language to its own color and size", () => {
  const settings = normalizeCaptionSettings({
    alignment: "left",
    englishColor: "#abcdef",
    portugueseColor: "#fedcba",
    englishSize: 24,
    portugueseSize: 20,
  });

  assert.deepEqual(captionStyleForLanguage(settings, "en"), {
    color: "#abcdef",
    size: 24,
  });
  assert.deepEqual(captionStyleForLanguage(settings, "pt"), {
    color: "#fedcba",
    size: 20,
  });
});
