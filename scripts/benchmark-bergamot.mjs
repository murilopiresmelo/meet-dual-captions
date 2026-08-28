import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LatencyOptimisedTranslator,
  TranslatorBacking,
} from "@browsermt/bergamot-translator/translator.js";
import metrics from "../translation-metrics.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelRoot = resolve(root, "models/bergamot/en-pt");
const asArrayBuffer = async (name) => {
  const buffer = await readFile(resolve(modelRoot, name));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

class LocalBacking extends TranslatorBacking {
  async loadModelRegistery() {
    return [{ from: "en", to: "pt" }];
  }

  async loadTranslationModel() {
    return {
      model: await asArrayBuffer("model.enpt.intgemm.alphas.bin"),
      shortlist: await asArrayBuffer("lex.50.50.enpt.s2t.bin"),
      vocabs: [await asArrayBuffer("vocab.enpt.spm")],
      config: {},
    };
  }
}

const translator = new LatencyOptimisedTranslator(
  { cacheSize: 0, useNativeIntGemm: false },
  new LocalBacking({ cacheSize: 0, useNativeIntGemm: false }),
);
const samples = [
  "Hello, how are you today?",
  "We need to review the project before the meeting.",
  "The customer asked for a faster and more reliable solution.",
  "Please send me the updated document tomorrow morning.",
  "This feature should work without any external service.",
  "Can you explain the next step in more detail?",
  "I agree with the plan, but we need to validate the result.",
  "The translation must appear below the original caption.",
  "Let's continue after everyone joins the call.",
  "Thank you for your help with this project.",
];

try {
  const warmupStarted = performance.now();
  await translator.translate({ from: "en", to: "pt", text: "Warm up.", html: false });
  const warmupMs = performance.now() - warmupStarted;
  const latencies = [];
  const outputs = [];

  for (const text of samples) {
    const started = performance.now();
    const response = await translator.translate({ from: "en", to: "pt", text, html: false });
    latencies.push(performance.now() - started);
    outputs.push({ source: text, translation: response.target.text });
  }

  console.log(JSON.stringify({
    engine: "bergamot-wasm-int8",
    warmupMs: Math.round(warmupMs),
    latency: metrics.summarizeLatencies(latencies),
    outputs,
  }, null, 2));
} finally {
  await translator.delete();
}
