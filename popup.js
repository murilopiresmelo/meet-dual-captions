(function () {
  "use strict";

  const SETTINGS_KEY = "captionSettings";
  const { DEFAULT_CAPTION_SETTINGS, normalizeCaptionSettings } = globalThis.meetDualSettings;
  const fields = ["alignment", "englishColor", "portugueseColor", "englishSize", "portugueseSize"];
  const status = document.getElementById("status");

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

  for (const field of fields) document.getElementById(field).addEventListener("input", save);
  document.getElementById("reset").addEventListener("click", async () => {
    display(DEFAULT_CAPTION_SETTINGS);
    await save();
  });

  chrome.storage.local.get(SETTINGS_KEY).then((stored) => {
    display(normalizeCaptionSettings(stored[SETTINGS_KEY]));
  });
})();
