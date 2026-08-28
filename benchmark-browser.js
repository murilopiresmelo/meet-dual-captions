import {
  LatencyOptimisedTranslator,
  TranslatorBacking,
} from "./node_modules/@browsermt/bergamot-translator/translator.js";

const root = "./models/bergamot/en-pt/";
const load = async (name) => (await fetch(root + name)).arrayBuffer();

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
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const translator = new LatencyOptimisedTranslator(
  { cacheSize: 0, useNativeIntGemm: false },
  new LocalBacking({ cacheSize: 0, useNativeIntGemm: false }),
);

try {
  const warmupStarted = performance.now();
  await translator.translate({ from: "en", to: "pt", text: "Warm up.", html: false });
  const warmupMs = performance.now() - warmupStarted;
  const latencies = [];
  const outputs = [];

  for (const source of samples) {
    const started = performance.now();
    const response = await translator.translate({ from: "en", to: "pt", text: source, html: false });
    latencies.push(performance.now() - started);
    outputs.push({ source, translation: response.target.text });
  }

  const report = {
    engine: "bergamot-wasm-int8",
    warmupMs: Math.round(warmupMs),
    latency: meetDualMetrics.summarizeLatencies(latencies),
    outputs,
  };
  status.textContent = report.latency.passes ? "PASSOU" : "FALHOU";
  result.textContent = JSON.stringify(report, null, 2);
  document.body.dataset.status = status.textContent;
} catch (error) {
  status.textContent = "ERRO";
  result.textContent = error.stack || String(error);
  document.body.dataset.status = "ERRO";
} finally {
  await translator.delete();
}
