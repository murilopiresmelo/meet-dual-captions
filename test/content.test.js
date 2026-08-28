const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeLatencies } = require("../translation-metrics.js");

const {
  captionPairFromTranslation,
  captionRoleFromSpeakerLabel,
  captionPlacement,
  createLatestOnlyScheduler,
  detectLanguage,
  detectSourceLanguage,
  generatedCaptionText,
  incrementalTextPatch,
  isCaptionUiText,
  isCaptionStyleVisible,
  isCaptionElement,
  isTranslatedCaptionType,
  latestCaptionText,
  normalizeCaption,
  pairCaptions,
  pickCaptionRegion,
  pickSourceCaption,
  readEnabled,
  selectDisplayedPair,
  selectedTranslatedLanguage,
  selectedMeetingLanguage,
  toggleText,
} = require("../content.js");

test("appends only new translated words when the existing prefix is stable", () => {
  assert.deepEqual(
    incrementalTextPatch("Olá, como", "Olá, como você está hoje?"),
    { start: 9, deleteCount: 0, insert: " você está hoje?" },
  );
});

test("keeps the previous generated line visible while the next translation is pending", () => {
  const pair = {
    original: { text: "How are you?", language: "en" },
    translation: { text: "Como você está?", language: "pt" },
  };
  assert.equal(generatedCaptionText(pair, "en"), "Como você está?");
  assert.equal(generatedCaptionText(pair, "pt"), "How are you?");
});

test("translates one caption at a time and keeps only the newest pending caption", () => {
  const started = [];
  const dropped = [];
  const scheduler = createLatestOnlyScheduler(
    (request) => started.push(request.requestId),
    (request) => dropped.push(request.requestId),
  );

  scheduler.enqueue({ requestId: 1 });
  scheduler.enqueue({ requestId: 2 });
  scheduler.enqueue({ requestId: 3 });
  scheduler.finish(1);

  assert.deepEqual(started, [1, 3]);
  assert.deepEqual(dropped, [2]);
});

test("keeps English above Portuguese for local translation", () => {
  assert.deepEqual(
    captionPairFromTranslation("Bom dia.", "pt", "Good morning."),
    {
      original: { text: "Good morning.", language: "en" },
      translation: { text: "Bom dia.", language: "pt" },
    },
  );
});

test("uses the newest original Meet caption as the translation source", () => {
  assert.deepEqual(
    pickSourceCaption([
      { text: "old", role: "original", order: 0 },
      { text: "tradução antiga", role: "translation", order: 2 },
      { text: "current", role: "original", order: 3 },
    ]),
    { text: "current", role: "original", order: 3 },
  );
});

test("recognizes the translated Meet track from its speaker label", () => {
  assert.equal(
    captionRoleFromSpeakerLabel("Alex Silva e outras 1 pessoas com tradução do Inglês"),
    "translation",
  );
  assert.equal(captionRoleFromSpeakerLabel("Alex Silva e outras 1 pessoas"), "original");
});

test("summarizes translation latency against the 500 ms budget", () => {
  assert.deepEqual(summarizeLatencies([120, 180, 240, 510]), {
    samples: 4,
    p50: 180,
    p95: 510,
    max: 510,
    passes: false,
  });
});

test("reads the selected translated-caption language from Meet", () => {
  assert.equal(
    selectedTranslatedLanguage({
      querySelector: () => ({ getAttribute: () => "pt" }),
    }),
    "pt",
  );
});

test("reads the selected meeting language for ambiguous live captions", () => {
  assert.equal(
    selectedMeetingLanguage({ querySelector: () => ({ getAttribute: () => "en-US" }) }),
    "en",
  );
});

test("distinguishes translated captions from instant captions", () => {
  assert.equal(isTranslatedCaptionType("closed_caption Legendas traduzidas"), true);
  assert.equal(isTranslatedCaptionType("closed_caption Legenda instantânea"), false);
});

test("normalizes Meet caption whitespace", () => {
  assert.equal(normalizeCaption("  Vanessa:\n  Hello   world  "), "Vanessa: Hello world");
});

test("keeps only the latest native caption chunks", () => {
  assert.equal(
    latestCaptionText([
      "trecho antigo",
      "",
      "trecho português atual",
      "",
      "continuação atual",
    ]),
    "trecho português atual continuação atual",
  );
});

test("limits a single accumulated caption block", () => {
  assert.equal(latestCaptionText(["primeira segunda terceira quarta"], 18), "terceira quarta");
});

test("detects English and Portuguese without an external service", () => {
  assert.equal(detectLanguage("We are going to discuss the project today"), "en");
  assert.equal(detectLanguage("Nós vamos conversar sobre o projeto hoje"), "pt");
});

test("ignores stale Meet language metadata when detecting the source caption", () => {
  assert.equal(
    detectSourceLanguage({ text: "We need to review the project today.", lang: "pt-BR" }, "pt"),
    "en",
  );
});

test("keeps English original above Portuguese translation", () => {
  assert.deepEqual(
    pairCaptions([
      {
        text: "Vanessa: My husband is joining the conversation today.",
        lang: "en",
        visible: false,
        order: 0,
      },
      {
        text: "Vanessa: Meu marido vai participar da conversa de hoje.",
        lang: "pt-BR",
        visible: true,
        order: 1,
      },
    ]),
    {
      original: {
        text: "Vanessa: My husband is joining the conversation today.",
        language: "en",
      },
      translation: {
        text: "Vanessa: Meu marido vai participar da conversa de hoje.",
        language: "pt",
      },
    },
  );
});

test("inverts automatically when Portuguese is the original", () => {
  assert.deepEqual(
    pairCaptions([
      {
        text: "Alex: Vamos começar a reunião agora.",
        lang: "pt-BR",
        visible: false,
        order: 0,
      },
      {
        text: "Alex: We are going to start the meeting now.",
        lang: "en-US",
        visible: true,
        order: 1,
      },
    ]),
    {
      original: {
        text: "Alex: Vamos começar a reunião agora.",
        language: "pt",
      },
      translation: {
        text: "Alex: We are going to start the meeting now.",
        language: "en",
      },
    },
  );
});

test("does not fabricate a pair until both languages are available", () => {
  assert.equal(
    pairCaptions([{ text: "Vanessa: Hello everyone", lang: "en", visible: true }]),
    null,
  );
});

test("uses the newest translated track after Meet changes the target language", () => {
  assert.deepEqual(
    pairCaptions([
      { text: "Hallo, hoe gaan dit met jou?", lang: "pt", role: "translation", order: 0 },
      { text: "How are you doing today?", lang: "en", role: "original", order: 1 },
      { text: "Inscreva-se.", lang: "pt", role: "translation", order: 2 },
    ]),
    {
      original: { text: "How are you doing today?", language: "en" },
      translation: { text: "Inscreva-se.", language: "pt" },
    },
  );
});

test("infers Portuguese for a short translated track after Meet closes settings", () => {
  assert.deepEqual(
    pairCaptions([
      { text: "How are you doing today?", role: "original", order: 0 },
      { text: "Inscreva-se.", role: "translation", order: 1 },
    ]),
    {
      original: { text: "How are you doing today?", language: "en" },
      translation: { text: "Inscreva-se.", language: "pt" },
    },
  );
});

test("pairs short explicit Meet tracks without language hints", () => {
  assert.deepEqual(
    pairCaptions([
      { text: "Okay.", role: "original", order: 0 },
      { text: "Certo.", role: "translation", order: 1 },
    ]),
    {
      original: { text: "Okay.", language: "en" },
      translation: { text: "Certo.", language: "pt" },
    },
  );
});

test("never mistakes the extension overlay for the Meet caption region", () => {
  const meetRegion = { id: "meet-captions" };
  const extensionOverlay = { id: "meet-dual-captions" };
  assert.equal(pickCaptionRegion([meetRegion, extensionOverlay]), meetRegion);
});

test("prefers the actual Meet captions over its notification log", () => {
  const captions = {
    id: "",
    getAttribute: (name) => name === "aria-label" ? "Legendas" : null,
  };
  const notificationLog = {
    id: "",
    getAttribute: (name) => name === "aria-live" ? "polite" : null,
  };

  assert.equal(pickCaptionRegion([captions, notificationLog]), captions);
});

test("ignores Meet controls inside the captions region", () => {
  assert.equal(isCaptionUiText("arrow_downward Ir para o fim"), true);
  assert.equal(isCaptionUiText("Ir para as legendas mais recentes"), true);
  assert.equal(isCaptionUiText("Hello, how are you today?"), false);
});

test("places the dual overlay exactly over the native Meet caption area", () => {
  assert.deepEqual(
    captionPlacement({ left: 250, bottom: 620, width: 800 }, 1307, 729),
    { left: 250, bottom: 109, width: 800 },
  );
});

test("keeps recognizing a native caption region after pointer events are disabled", () => {
  assert.equal(
    isCaptionStyleVisible({ display: "block", visibility: "visible", pointerEvents: "none" }),
    true,
  );
});

test("detects a short replaced Portuguese caption and its English translation", () => {
  assert.deepEqual(
    pairCaptions([
      { text: "Alex: Sim.", visible: false, source: "replaced", order: 0 },
      { text: "You: Yes.", lang: "en", visible: true, order: 1 },
    ]),
    {
      original: { text: "Alex: Sim.", language: "pt" },
      translation: { text: "You: Yes.", language: "en" },
    },
  );
});

test("does not turn unrelated Meet interface text into a translation", () => {
  assert.equal(
    pairCaptions([
      { text: "Tamanho da fonte", visible: false, source: "replaced", order: 0 },
      { text: "You: Hello, how are you today?", lang: "en", visible: true, order: 1 },
    ]),
    null,
  );
});

test("does not treat an ancestor containing captions as caption content", () => {
  const ancestor = {
    id: "",
    closest: () => null,
    matches: () => false,
    querySelector: () => ({ id: "captions" }),
  };
  assert.equal(isCaptionElement(ancestor, null), false);
});

test("keeps the last complete pair while Meet prepares the next translation", () => {
  const previousPair = {
    original: { text: "Alex: Sim.", language: "pt" },
    translation: { text: "You: Yes.", language: "en" },
  };
  assert.equal(selectDisplayedPair(null, previousPair), previousPair);
  assert.equal(selectDisplayedPair(null, previousPair, false), null);
  assert.equal(selectDisplayedPair(null, previousPair, true, false), null);
});

test("keeps the menu toggle enabled by default and respects the saved state", () => {
  assert.equal(readEnabled({ getItem: () => null }), true);
  assert.equal(readEnabled({ getItem: () => "false" }), false);
  assert.equal(toggleText(true), "Legendas duplas - Ligadas");
  assert.equal(toggleText(false), "Legendas duplas - Desligadas");
});
