"use strict";

const MODEL_DIRECTORIES = { enpt: "en-pt", pten: "pt-en" };

function modelFilePaths(from, to) {
  const pair = `${from}${to}`;
  const directory = MODEL_DIRECTORIES[pair];
  if (!directory) throw new Error(`Direção de tradução não suportada: ${from} → ${to}`);
  const root = `./models/bergamot/${directory}/`;
  return {
    model: `${root}model.${pair}.intgemm.alphas.bin`,
    shortlist: `${root}lex.50.50.${pair}.s2t.bin`,
    vocab: `${root}vocab.${pair}.spm`,
  };
}

if (typeof module === "object" && module.exports) {
  module.exports = { modelFilePaths };
} else {
const SOURCE = "meet-dual-translator-host";
const load = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Falha ao carregar ${path}: HTTP ${response.status}`);
  return response.arrayBuffer();
};

const options = { cacheSize: 0, pivotLanguage: null, useNativeIntGemm: false };
const translatorPromise = (async () => {
  const { LatencyOptimisedTranslator, TranslatorBacking } = await import("./vendor/bergamot/translator.js");
  class LocalBacking extends TranslatorBacking {
    async loadModelRegistery() {
      return Object.keys(MODEL_DIRECTORIES).map((pair) => ({
        from: pair.slice(0, 2),
        to: pair.slice(2),
      }));
    }

    async loadTranslationModel({ from, to }) {
      const files = modelFilePaths(from, to);
      const [model, shortlist, vocab] = await Promise.all([
        load(files.model),
        load(files.shortlist),
        load(files.vocab),
      ]);
      return { model, shortlist, vocabs: [vocab], config: {} };
    }
  }

  const started = performance.now();
  const translator = new LatencyOptimisedTranslator(options, new LocalBacking(options));
  await translator.translate({ from: "en", to: "pt", text: "Warm up.", html: false });
  chrome.runtime.sendMessage({
    target: "content",
    source: SOURCE,
    type: "ready",
    warmupMs: Math.round(performance.now() - started),
  }).catch(() => {});
  return translator;
})().catch((error) => {
  chrome.runtime.sendMessage({ target: "content", source: SOURCE, type: "error", error: error.message }).catch(() => {});
  return null;
});

async function translate(request) {
  try {
    const translator = await translatorPromise;
    if (!translator) throw new Error("O tradutor local não iniciou.");
    const started = performance.now();
    const response = await translator.translate({
      from: request.sourceLanguage,
      to: request.sourceLanguage === "pt" ? "en" : "pt",
      text: request.sourceText,
      html: false,
    });
    return {
      ok: true,
      target: "content",
      source: SOURCE,
      type: "result",
      requestId: request.requestId,
      translation: response.target.text,
      processingMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      ok: false,
      target: "content",
      source: SOURCE,
      type: "error",
      requestId: request.requestId,
      error: error.message,
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "offscreen") return false;
  if (message.type === "ping") {
    sendResponse({ ok: true });
  } else if (message.type === "translate") {
    translate(message.request).then(sendResponse);
    return true;
  }
  return false;
});

chrome.runtime.sendMessage({ target: "content", source: SOURCE, type: "host-loaded" }).catch(() => {});
}
