(function (root) {
  "use strict";

  function normalizeRuntimeState(value = {}) {
    return {
      enabled: value.enabled !== false,
      historyEnabled: value.historyEnabled === true,
    };
  }

  function runtimeStatus(response) {
    if (response?.ok) return "Aplicado nesta aba";
    if (response?.reason === "not-meet") return "Abra uma reunião do Google Meet.";
    return "Abra ou recarregue uma reunião do Google Meet.";
  }

  const api = { normalizeRuntimeState, runtimeStatus };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.meetDualPopupState = api;
})(typeof globalThis === "object" ? globalThis : this);
