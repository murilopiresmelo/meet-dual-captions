const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRuntimeState, runtimeStatus } = require("../popup-state.js");

test("keeps captions on and temporary history off by default", () => {
  assert.deepEqual(normalizeRuntimeState(), { enabled: true, historyEnabled: false });
  assert.deepEqual(normalizeRuntimeState({ enabled: false, historyEnabled: true }), {
    enabled: false,
    historyEnabled: true,
  });
});

test("explains when the Meet tab needs the updated content script", () => {
  assert.equal(runtimeStatus({ ok: true }), "Aplicado nesta aba");
  assert.equal(runtimeStatus({ reason: "not-meet" }), "Abra uma reunião do Google Meet.");
  assert.equal(runtimeStatus(null), "Abra ou recarregue uma reunião do Google Meet.");
});
