"use strict";

let creatingOffscreenDocument;

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: "translator-host.html",
      reasons: ["WORKERS"],
      justification: "Executar a tradução local das legendas em um Web Worker.",
    }).finally(() => { creatingOffscreenDocument = null; });
  }
  await creatingOffscreenDocument;
}

async function waitForOffscreenReceiver() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await chrome.runtime.sendMessage({ target: "offscreen", type: "ping" });
      if (response?.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("O tradutor local não iniciou.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "background") return false;
  ensureOffscreenDocument()
    .then(waitForOffscreenReceiver)
    .then(() => {
      chrome.runtime.sendMessage({
        target: "content",
        source: "meet-dual-translator-host",
        type: "background-ready",
      });
      if (message.type === "translate") {
        return chrome.runtime.sendMessage({
          target: "offscreen",
          type: "translate",
          request: message.request,
        });
      }
      return undefined;
    })
    .then((response) => sendResponse(response ?? { ok: true }))
    .catch((error) => {
      chrome.runtime.sendMessage({
        target: "content",
        source: "meet-dual-translator-host",
        type: "error",
        error: error.message,
      });
      sendResponse({ ok: false, error: error.message });
    });
  return true;
});
