(function () {
  "use strict";

  const SETTINGS_KEY = "captionSettings";
  const { DEFAULT_CAPTION_SETTINGS, normalizeCaptionSettings } = globalThis.meetDualSettings;
  const { normalizeRuntimeState, runtimeStatus } = globalThis.meetDualPopupState;
  const fields = ["alignment", "englishColor", "portugueseColor", "englishSize", "portugueseSize"];
  const status = document.getElementById("status");
  const runtimeStatusElement = document.getElementById("runtimeStatus");
  const runtimeControls = {
    enabled: document.getElementById("captionsEnabled"),
    historyEnabled: document.getElementById("historyEnabled"),
  };

  function display(settings) {
    for (const field of fields) document.getElementById(field).value = settings[field];
    document.querySelector('output[for="englishSize"]').value = `${settings.englishSize}px`;
    document.querySelector('output[for="portugueseSize"]').value = `${settings.portugueseSize}px`;
  }

  function read() {
    return normalizeCaptionSettings(Object.fromEntries(
      fields.map((field) => [field, document.getElementById(field).value]),
    ));
  }

  async function save() {
    const settings = read();
    display(settings);
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    status.textContent = "Aplicado";
  }

  function displayRuntimeState(value, ready) {
    const state = normalizeRuntimeState(value);
    for (const [key, control] of Object.entries(runtimeControls)) {
      control.checked = state[key];
      control.disabled = !ready;
    }
    return state;
  }

  async function sendRuntimeMessage(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || (tab.url && !tab.url.startsWith("https://meet.google.com/"))) {
      return { ok: false, reason: "not-meet" };
    }
    try {
      return await chrome.tabs.sendMessage(tab.id, {
        target: "content",
        source: "meet-dual-popup",
        ...message,
      });
    } catch {
      return null;
    }
  }

  async function refreshRuntimeState() {
    const response = await sendRuntimeMessage({ type: "get-state" });
    displayRuntimeState(response?.state, Boolean(response?.ok));
    runtimeStatusElement.textContent = runtimeStatus(response);
    runtimeStatusElement.dataset.ready = String(Boolean(response?.ok));
  }

  for (const [key, control] of Object.entries(runtimeControls)) {
    control.addEventListener("change", async () => {
      const response = await sendRuntimeMessage({
        type: "set-state",
        state: { [key]: control.checked },
      });
      displayRuntimeState(response?.state, Boolean(response?.ok));
      runtimeStatusElement.textContent = runtimeStatus(response);
      runtimeStatusElement.dataset.ready = String(Boolean(response?.ok));
    });
  }

  for (const field of fields) document.getElementById(field).addEventListener("input", save);
  document.getElementById("reset").addEventListener("click", async () => {
    display(DEFAULT_CAPTION_SETTINGS);
    await save();
  });

  chrome.storage.local.get(SETTINGS_KEY).then((stored) => {
    display(normalizeCaptionSettings(stored[SETTINGS_KEY]));
  });
  refreshRuntimeState();
})();
