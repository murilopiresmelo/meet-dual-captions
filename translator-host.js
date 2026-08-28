"use strict";

const SOURCE = "meet-dual-translator-host";
const modelRoot = "./models/bergamot/en-pt/";
const load = async (name) => {
  const response = await fetch(modelRoot + name);
  if (!response.ok) throw new Error(`Falha ao carregar ${name}: HTTP ${response.status}`);
  return response.arrayBuffer();
};

const options = { cacheSize: 0, pivotLanguage: null, useNativeIntGemm: false };
const translatorPromise = (async () => {
  const { LatencyOptimisedTranslator, TranslatorBacking } = await import("./vendor/bergamot/translator.js");
  class LocalBacking extends TranslatorBacking {
    async loadModelRegistery() {
      return [{ from: "en", to: "pt" }];
    }

    async loadTranslationModel() {
      const [model, shortlist, vocab] = await Promise.all([
        load("model.enpt.intgemm.alphas.bin"),
        load("lex.50.50.enpt.s2t.bin"),
        load("vocab.enpt.spm"),
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
