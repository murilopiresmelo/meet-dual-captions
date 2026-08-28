(function (root) {
  "use strict";

  const DEFAULT_CAPTION_SETTINGS = Object.freeze({
    alignment: "center",
    englishColor: "#ffffff",
    portugueseColor: "#ffffff",
    englishSize: 22,
    portugueseSize: 22,
  });

  const color = (value, fallback) => /^#[0-9a-f]{6}$/iu.test(String(value || ""))
    ? String(value).toLowerCase()
    : fallback;
  const size = (value, fallback) => Number.isFinite(Number(value))
    ? Math.min(40, Math.max(14, Math.round(Number(value))))
    : fallback;

  function normalizeCaptionSettings(value = {}) {
    return {
      alignment: value.alignment === "left" ? "left" : "center",
      englishColor: color(value.englishColor, DEFAULT_CAPTION_SETTINGS.englishColor),
      portugueseColor: color(value.portugueseColor, DEFAULT_CAPTION_SETTINGS.portugueseColor),
      englishSize: size(value.englishSize, DEFAULT_CAPTION_SETTINGS.englishSize),
      portugueseSize: size(value.portugueseSize, DEFAULT_CAPTION_SETTINGS.portugueseSize),
    };
  }

  function captionStyleForLanguage(settings, language) {
    return language === "pt"
      ? { color: settings.portugueseColor, size: settings.portugueseSize }
      : { color: settings.englishColor, size: settings.englishSize };
  }

  const api = { DEFAULT_CAPTION_SETTINGS, captionStyleForLanguage, normalizeCaptionSettings };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.meetDualSettings = api;
})(typeof globalThis === "object" ? globalThis : this);
