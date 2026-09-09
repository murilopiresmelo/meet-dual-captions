(function () {
  "use strict";

  const OVERLAY_ID = "meet-dual-captions";
  const MENU_TOGGLE_ID = "meet-dual-captions-toggle";
  const HISTORY_PANEL_ID = "meet-dual-captions-history";
  const HISTORY_TOGGLE_ID = "meet-dual-captions-history-toggle";
  const TRANSLATOR_SOURCE = "meet-dual-translator-host";
  const STORAGE_KEY = "meet-dual-captions-enabled";
  const SETTINGS_KEY = "captionSettings";
  const CAPTION_REGION_SELECTOR = [
    '[aria-label="Captions"][role="region"]',
    '[aria-label="Legendas"][role="region"]',
    '[role="region"][aria-label*="caption" i]',
    '[role="region"][aria-label*="legenda" i]',
    '[jscontroller="D1tHje"]',
  ].join(",");
  const CAPTION_FALLBACK_SELECTOR = [
    '[role="region"][aria-live]',
    '[role="log"][aria-live]',
    '[aria-live="polite"]',
  ].join(",");
  const PORTUGUESE_WORDS = new Set([
    "agora", "ainda", "assim", "com", "como", "conversa", "da", "de", "do", "e",
    "ele", "ela", "está", "eu", "hoje", "isso", "meu", "minha", "não", "nós",
    "o", "os", "para", "por", "projeto", "que", "reunião", "sim", "também", "um", "uma",
    "vai", "vamos", "você",
  ]);
  const ENGLISH_WORDS = new Set([
    "a", "also", "and", "are", "conversation", "for", "going", "hello", "how", "in",
    "is", "it", "meeting", "my", "not", "now", "of", "project", "start", "that", "the",
    "this", "to", "today", "we", "what", "who", "with", "yes", "you", "your",
  ]);

  function attachHistoryMovement(panel, header) {
    let mode = "floating";
    let position = null;
    let drag = null;
    const root = document.documentElement;
    header.title = "Arraste para mover; solte na borda para encaixar";
    function update() {
      panel.dataset.mode = mode;
      if (!panel.hidden && mode !== "floating") root.dataset.meetDualDock = mode;
      else delete root.dataset.meetDualDock;
      if (mode === "floating" && position) {
        const rect = panel.getBoundingClientRect();
        position.x = Math.max(0, Math.min(position.x, window.innerWidth - rect.width));
        position.y = Math.max(0, Math.min(position.y, window.innerHeight - rect.height));
        panel.style.left = `${position.x}px`;
        panel.style.top = `${position.y}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
        panel.style.maxHeight = `${window.innerHeight - position.y}px`;
      } else {
        panel.style.cssText = "";
      }
    }
    const edge = (x) => x <= 32 ? "left" : x >= window.innerWidth - 32 ? "right" : "floating";
    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || drag) return;
      const rect = panel.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
        offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
        mode, position: position && { ...position }, moved: false };
      header.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    header.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
      drag.moved = true;
      mode = "floating";
      position = { x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY };
      update();
      panel.dataset.dragging = "true";
      panel.dataset.snap = edge(event.clientX);
    });
    function finish(cancel) {
      if (!drag) return;
      const previous = drag;
      drag = null;
      if (cancel) { mode = previous.mode; position = previous.position; }
      else if (previous.moved) mode = panel.dataset.snap || "floating";
      delete panel.dataset.dragging;
      delete panel.dataset.snap;
      if (header.hasPointerCapture(previous.id)) header.releasePointerCapture(previous.id);
      update();
    }
    header.addEventListener("pointerup", () => finish(false));
    header.addEventListener("pointercancel", () => finish(true));
    header.addEventListener("lostpointercapture", () => finish(true));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drag) { event.preventDefault(); finish(true); }
    });
    window.addEventListener("resize", () => { finish(true); update(); });
    new ResizeObserver(() => { if (mode === "floating" && position) update(); }).observe(panel);
    update();
    return () => { if (panel.hidden) finish(true); update(); };
  }

  function normalizeHistoryText(value) {
    return typeof value === "string"
      ? value.replace(/\s+/g, " ").trim()
      : "";
  }

  function normalizeCaption(value) {
    return normalizeHistoryText(value).slice(0, 1000);
  }

  function latestCaptionText(chunks, maxLength = 240) {
    const text = chunks.map(normalizeCaption).filter(Boolean).slice(-2).join(" ");
    if (text.length <= maxLength) return text;
    const tail = text.slice(-maxLength);
    const firstSpace = tail.indexOf(" ");
    return firstSpace === -1 ? tail : tail.slice(firstSpace + 1);
  }

  function normalizeLanguage(value) {
    const language = String(value || "").toLowerCase();
    if (language.startsWith("en")) return "en";
    if (language.startsWith("pt")) return "pt";
    return null;
  }

  function detectLanguage(text, hint) {
    const hinted = normalizeLanguage(hint);
    if (hinted) return hinted;

    const normalized = normalizeCaption(text).toLowerCase();
    const words = normalized.match(/[\p{L}']+/gu) || [];
    let portuguese = /[ãõáéíóúâêôç]/u.test(normalized) ? 2 : 0;
    let english = /\b\w+'(?:s|re|ve|ll|d|t)\b/u.test(normalized) ? 2 : 0;

    for (const word of words) {
      if (PORTUGUESE_WORDS.has(word)) portuguese += 1;
      if (ENGLISH_WORDS.has(word)) english += 1;
    }

    if (words.includes("sim")) return "pt";
    if (words.includes("yes")) return "en";
    if (portuguese === english || Math.max(portuguese, english) < 2) return null;
    return portuguese > english ? "pt" : "en";
  }

  function detectSourceLanguage(candidate, fallback = "en") {
    return detectLanguage(candidate?.text) || normalizeLanguage(fallback) || "en";
  }

  function captionRoleFromSpeakerLabel(value) {
    const label = normalizeCaption(value);
    if (!label) return null;
    return /translat|tradu/iu.test(label) ? "translation" : "original";
  }

  function captionSpeakerAndText(value, speakerValue = "") {
    const text = normalizeCaption(value);
    const speaker = normalizeCaption(speakerValue);
    if (speaker) {
      const prefix = `${speaker}:`;
      return {
        speaker,
        text: text.startsWith(prefix) ? normalizeCaption(text.slice(prefix.length)) : text,
      };
    }

    return { speaker: "Participante", text };
  }

  function meetingPathChanged(previousPath, nextPath) {
    return previousPath !== nextPath;
  }

  function upsertCaptionHistory(entries, value) {
    const next = {
      speaker: normalizeCaption(value.speaker) || "Participante",
      sourceText: normalizeHistoryText(value.sourceText),
      sourceLanguage: normalizeLanguage(value.sourceLanguage) || "en",
      translation: normalizeHistoryText(value.translation),
    };
    if (Number.isInteger(value.requestId)) next.requestId = value.requestId;
    if (value.entryId !== undefined) next.entryId = value.entryId;
    if (!next.sourceText) return null;

    let index = next.entryId === undefined
      ? -1
      : entries.findLastIndex((entry) => entry.entryId === next.entryId);
    if (index < 0 && Number.isInteger(next.requestId)) {
      index = entries.findLastIndex((entry) => entry.requestId === next.requestId);
    }
    if (index < 0 && next.entryId === undefined) {
      const last = entries.at(-1);
      const sameSpeaker = last?.speaker === next.speaker
        && last.sourceLanguage === next.sourceLanguage;
      const continuation = sameSpeaker && (
        next.sourceText.startsWith(last.sourceText)
        || last.sourceText.startsWith(next.sourceText)
      );
      if (continuation) index = entries.length - 1;
    }

    if (index < 0) {
      entries.push(next);
      return entries.length - 1;
    }

    const current = entries[index];
    if (
      next.translation
      && (
        current.sourceText !== next.sourceText
        || (
          Number.isInteger(current.requestId)
          && Number.isInteger(next.requestId)
          && current.requestId !== next.requestId
        )
      )
    ) return null;
    const sourceChanged = current.sourceText !== next.sourceText;
    const updated = {
      ...current,
      ...next,
      translation: next.translation || (sourceChanged ? "" : current.translation),
    };
    if (Object.keys(updated).every((key) => updated[key] === current[key])) return null;
    entries[index] = updated;
    return index;
  }

  function historyRequestMatches(entry, request) {
    return Boolean(
      entry
      && entry.sourceText === request.sourceText
      && entry.sourceLanguage === request.sourceLanguage
    );
  }

  function selectedTranslatedLanguage(root) {
    const option = root?.querySelector?.(
      '[role="listbox"][aria-label*="translat" i] [role="option"][aria-selected="true"][data-value],'
      + '[role="listbox"][aria-label*="traduz" i] [role="option"][aria-selected="true"][data-value]',
    );
    return normalizeLanguage(option?.getAttribute("data-value"));
  }

  function selectedMeetingLanguage(root) {
    const option = root?.querySelector?.(
      '[role="listbox"][aria-label*="meeting" i] [role="option"][aria-selected="true"][data-value],'
      + '[role="listbox"][aria-label*="reunião" i] [role="option"][aria-selected="true"][data-value]',
    );
    return normalizeLanguage(option?.getAttribute("data-value"));
  }

  function isTranslatedCaptionType(value) {
    return /translat|tradu/iu.test(normalizeCaption(value));
  }

  function pairCaptions(candidates) {
    const normalizedCandidates = candidates
      .map((candidate, order) => ({
        text: normalizeCaption(candidate.text),
        language: detectLanguage(candidate.text, candidate.lang),
        role: candidate.role || null,
        source: candidate.source || null,
        visible: candidate.visible !== false,
        order: candidate.order ?? order,
      }));

    const latestRole = (role) => normalizedCandidates
      .filter((candidate) => candidate.text && candidate.role === role)
      .sort((a, b) => b.order - a.order)[0] || null;
    const roleOriginal = latestRole("original");
    const roleTranslation = latestRole("translation");
    if (roleOriginal && roleTranslation) {
      if (roleOriginal.language && !roleTranslation.language) {
        roleTranslation.language = roleOriginal.language === "en" ? "pt" : "en";
      } else if (!roleOriginal.language && roleTranslation.language) {
        roleOriginal.language = roleTranslation.language === "en" ? "pt" : "en";
      } else if (!roleOriginal.language || roleOriginal.language === roleTranslation.language) {
        roleOriginal.language = "en";
        roleTranslation.language = "pt";
      }

      return {
        original: { text: roleOriginal.text, language: roleOriginal.language },
        translation: { text: roleTranslation.text, language: roleTranslation.language },
      };
    }

    const usable = normalizedCandidates.filter(({ text, language }) => text && language);

    const pick = (language) =>
      usable
        .filter((candidate) => candidate.language === language)
        .sort((a, b) => b.order - a.order)[0] || null;
    const english = pick("en");
    const portuguese = pick("pt");
    if (!english || !portuguese) return null;

    const pickRole = (role) => usable
      .filter((candidate) => candidate.role === role)
      .sort((a, b) => b.order - a.order)[0] || null;
    const explicitOriginal = pickRole("original");
    const explicitTranslation = pickRole("translation");
    let original = explicitOriginal;

    if (!original) {
      const hidden = [english, portuguese].filter((candidate) => !candidate.visible);
      original = hidden.length === 1
        ? hidden[0]
        : [english, portuguese].sort((a, b) => b.order - a.order)[0];
    }

    const translation = explicitTranslation && explicitTranslation.language !== original.language
      ? explicitTranslation
      : original.language === "en" ? portuguese : english;

    return {
      original: { text: original.text, language: original.language },
      translation: { text: translation.text, language: translation.language },
    };
  }

  function pickSourceCaption(candidates) {
    return candidates
      .filter((candidate) => normalizeCaption(candidate.text) && candidate.role !== "translation")
      .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))[0] || null;
  }

  function captionPairFromTranslation(sourceText, sourceLanguage, translatedText = "…") {
    const source = normalizeCaption(sourceText);
    const translated = normalizeCaption(translatedText) || "…";
    return sourceLanguage === "pt"
      ? {
        original: { text: translated, language: "en" },
        translation: { text: source, language: "pt" },
      }
      : {
        original: { text: source, language: "en" },
        translation: { text: translated, language: "pt" },
      };
  }

  function generatedCaptionText(pair, sourceLanguage) {
    if (!pair) return "…";
    return sourceLanguage === "pt" ? pair.original.text : pair.translation.text;
  }

  function incrementalTextPatch(currentValue, nextValue) {
    const current = normalizeCaption(currentValue);
    const next = normalizeCaption(nextValue);
    let start = 0;
    while (start < current.length && start < next.length && current[start] === next[start]) start += 1;
    if (start < current.length && start < next.length) {
      const wordBoundary = next.lastIndexOf(" ", start - 1);
      start = wordBoundary < 0 ? 0 : wordBoundary + 1;
    }
    return { start, deleteCount: current.length - start, insert: next.slice(start) };
  }

  function pickCaptionRegion(regions) {
    const candidates = regions.filter(({ id }) => id !== OVERLAY_ID);
    const namedCaptions = candidates.filter((region) =>
      /caption|legenda/iu.test(region.getAttribute?.("aria-label") || region.ariaLabel || ""));
    return namedCaptions.at(-1) || candidates.at(-1) || null;
  }

  function captionPlacement(rect, viewportWidth, viewportHeight) {
    const left = Math.max(0, Math.round(rect.left));
    return {
      left,
      bottom: Math.max(0, Math.round(viewportHeight - rect.bottom)),
      width: Math.max(0, Math.round(Math.min(rect.width, viewportWidth - left))),
    };
  }

  function isCaptionStyleVisible(style) {
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function selectDisplayedPair(currentPair, previousPair, previousIsFresh = true, hasDualTracks = true) {
    if (!hasDualTracks) return null;
    return currentPair || (previousIsFresh ? previousPair : null) || null;
  }

  function readEnabled(storage) {
    try {
      return storage.getItem(STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  }

  function toggleText(enabled) {
    return `Legendas duplas - ${enabled ? "Ligadas" : "Desligadas"}`;
  }

  function historyToggleText(enabled) {
    return `Histórico temporário - ${enabled ? "Ligado" : "Desligado"}`;
  }

  function isCaptionUiText(text) {
    return /(?:arrow_downward\s*)?ir para (?:o fim|as legendas mais recentes)/iu.test(
      normalizeCaption(text),
    );
  }

  function isCaptionElement(element, region) {
    if (!element || element.closest?.(`#${OVERLAY_ID}`)) return false;
    if (region && (region === element || region.contains?.(element))) return true;
    return Boolean(
      element.matches?.(CAPTION_REGION_SELECTOR)
      || element.closest?.(CAPTION_REGION_SELECTOR),
    );
  }

  function createLatestOnlyScheduler(start, drop = () => {}) {
    let active = null;
    let pending = null;
    const historyQueue = [];

    const enqueue = (item) => {
      if (active) {
        if (item.kind === "history") {
          historyQueue.push(item);
          return;
        }
        if (pending) drop(pending);
        pending = item;
        return;
      }
      active = item;
      start(item);
    };

    return {
      enqueue,
      finish(requestId) {
        if (active?.requestId !== requestId) return;
        active = null;
        const next = pending || historyQueue.shift();
        pending = null;
        if (next) enqueue(next);
      },
      reset() {
        if (pending) drop(pending);
        for (const item of historyQueue) drop(item);
        active = null;
        pending = null;
        historyQueue.length = 0;
      },
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      attachHistoryMovement,
      captionPairFromTranslation,
      captionRoleFromSpeakerLabel,
      captionSpeakerAndText,
      captionPlacement,
      createLatestOnlyScheduler,
      detectLanguage,
      detectSourceLanguage,
      generatedCaptionText,
      incrementalTextPatch,
      historyToggleText,
      historyRequestMatches,
      isCaptionUiText,
      isCaptionStyleVisible,
      isCaptionElement,
      isTranslatedCaptionType,
      latestCaptionText,
      meetingPathChanged,
      normalizeCaption,
      pairCaptions,
      pickCaptionRegion,
      pickSourceCaption,
      readEnabled,
      selectDisplayedPair,
      selectedMeetingLanguage,
      selectedTranslatedLanguage,
      toggleText,
      upsertCaptionHistory,
    };
    return;
  }

  const { captionStyleForLanguage, normalizeCaptionSettings } = globalThis.meetDualSettings;
  let enabled = readEnabled(window.localStorage);
  let historyEnabled = false;
  let captionSettings = normalizeCaptionSettings();
  // ponytail: keep every in-tab entry as requested; virtualize only if long meetings become slow.
  const captionHistory = [];
  let captionBlockHistory = new WeakMap();
  let ignoredCaptionBlocks = new WeakMap();
  let captionHistorySerial = 0;
  let historyMeetingPath = window.location.pathname;
  let historyMeetingRevision = 0;
  let historyTranslationSerial = 0;
  const historyTranslationStatus = new Map();
  let displayedPair = null;
  let lastPair = null;
  let lastPairSourceText = "";
  let lastRequestedText = "";
  let lastSourceLanguage = "en";
  let translationSerial = 0;
  let translationLatencies = [];
  let translatorReady = false;
  let translatorRequested = false;
  let translationScheduler;
  const translationStartedAt = new Map();
  const translationRequests = new Map();
  let overlay;
  let originalText;
  let translationText;
  let originalLabel;
  let translationLabel;
  let nativeRegion;
  let historyPanel;
  let historyList;
  let historyCount;
  let historyEmpty;
  let updateHistoryMovement;
  let debugState = {
    version: "0.6.1",
    build: "bergamot-local-en-pt-bidirectional",
    enabled,
    hasRegion: false,
    pairFound: false,
    candidates: 0,
    regionSelectorTried: `${CAPTION_REGION_SELECTOR},${CAPTION_FALLBACK_SELECTOR}`,
  };

  function updateDebugState(patch) {
    debugState = { ...debugState, ...patch };
    window.__meetDualCaptionsDebug = Object.freeze({ ...debugState, timestamp: Date.now() });
    if (overlay) overlay.dataset.debug = JSON.stringify(debugState);
  }

  if (!window.__meetDualCaptionsDebug) {
    window.__meetDualCaptionsDebug = Object.freeze({ ...debugState, timestamp: Date.now() });
  }

  function queryAllAccessible(root, selector) {
    if (!root || typeof root.querySelectorAll !== "function") return [];

    const nodes = [...root.querySelectorAll(selector)];
    const hosts = [...root.querySelectorAll("*")].filter((node) => node.shadowRoot);
    const fromShadow = hosts.flatMap((host) => queryAllAccessible(host.shadowRoot, selector));
    return [...new Set([...nodes, ...fromShadow])];
  }

  function matchingTextNodes(root, pattern) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const matches = [];
    let node;
    while ((node = walker.nextNode())) {
      if (pattern.test(normalizeCaption(node.nodeValue))) matches.push(node);
    }
    return matches;
  }

  function updateToggleItem(item, checked, label) {
    if (!item) return;
    item.setAttribute("aria-checked", String(checked));
    item.setAttribute("aria-label", label);
    item.querySelector("[data-meet-dual-captions-toggle-label]").textContent = label;
  }

  function updateMenuToggles() {
    updateToggleItem(
      document.getElementById(MENU_TOGGLE_ID),
      enabled,
      toggleText(enabled),
    );
    updateToggleItem(
      document.getElementById(HISTORY_TOGGLE_ID),
      historyEnabled,
      historyToggleText(historyEnabled),
    );
  }

  function resetTranslationState() {
    translationSerial += 1;
    lastPair = null;
    lastPairSourceText = "";
    lastRequestedText = "";
    for (const request of translationRequests.values()) {
      if (request.kind === "history") historyTranslationStatus.delete(request.historyIndex);
    }
    translationRequests.clear();
    translationStartedAt.clear();
    translationScheduler?.reset();
  }

  function setEnabled(nextEnabled) {
    enabled = nextEnabled;
    if (!enabled) resetTranslationState();
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // The control still works for this tab when storage is unavailable.
    }
    updateMenuToggles();
    updateHistoryPanelVisibility();
    refresh();
  }

  function setHistoryEnabled(nextEnabled) {
    historyEnabled = nextEnabled;
    updateMenuToggles();
    updateHistoryPanelVisibility();
    if (historyEnabled) refresh();
  }

  function createMenuToggle(settingsItem, id, icon, onToggle) {
    const settingsPattern = /^(configurações|settings)$/iu;
    const item = settingsItem.cloneNode(true);
    for (const element of [item, ...item.querySelectorAll("*")]) {
      for (const attribute of [...element.attributes]) {
        if (
          attribute.name === "id"
          || attribute.name.startsWith("data-")
          || attribute.name.startsWith("js")
          || /^(aria-label|aria-haspopup|aria-expanded|aria-controls|aria-owns)$/u.test(attribute.name)
        ) {
          element.removeAttribute(attribute.name);
        }
      }
    }

    const labels = matchingTextNodes(item, settingsPattern);
    const labelNode = labels.at(-1);
    if (!labelNode) return null;
    if (labels.length > 1 && settingsPattern.test(normalizeCaption(labels[0].nodeValue))) {
      labels[0].nodeValue = icon;
    }

    const label = document.createElement("span");
    label.setAttribute("data-meet-dual-captions-toggle-label", "");
    labelNode.replaceWith(label);
    item.id = id;
    item.setAttribute("role", "menuitemcheckbox");
    const toggle = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      onToggle();
    };
    item.addEventListener("click", toggle, true);
    item.addEventListener("keydown", (event) => {
      if (item.tagName !== "BUTTON" && (event.key === "Enter" || event.key === " ")) toggle(event);
    }, true);
    settingsItem.before(item);
    return item;
  }

  function ensureMenuToggle() {
    if (
      document.getElementById(MENU_TOGGLE_ID)
      && document.getElementById(HISTORY_TOGGLE_ID)
    ) return;
    const menuItems = [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')];
    const settingsPattern = /^(configurações|settings)$/iu;
    const settingsItem = menuItems.find((item) => matchingTextNodes(item, settingsPattern).length);
    if (!settingsItem) return;

    if (!document.getElementById(MENU_TOGGLE_ID)) {
      const item = createMenuToggle(
        settingsItem,
        MENU_TOGGLE_ID,
        "closed_caption",
        () => setEnabled(!enabled),
      );
      updateToggleItem(item, enabled, toggleText(enabled));
    }
    if (!document.getElementById(HISTORY_TOGGLE_ID)) {
      const item = createMenuToggle(
        settingsItem,
        HISTORY_TOGGLE_ID,
        "history",
        () => setHistoryEnabled(!historyEnabled),
      );
      updateToggleItem(item, historyEnabled, historyToggleText(historyEnabled));
    }
  }

  let captionModePending = false;
  function ensureInstantCaptionMode() {
    const combobox = [...document.querySelectorAll('[role="combobox"]')]
      .find((element) => /caption type|tipo de legenda/iu.test(element.getAttribute("aria-label") || ""));
    if (!combobox || !isTranslatedCaptionType(combobox.textContent) || captionModePending) return;

    captionModePending = true;
    combobox.click();
    requestAnimationFrame(() => {
      const option = [...document.querySelectorAll('[role="option"]')]
        .find((element) => isVisible(element) && (
          element.getAttribute("data-value") === "live"
          || /instant|live caption/iu.test(element.textContent)
        ));
      option?.click();
      setTimeout(() => { captionModePending = false; }, 1_000);
    });
  }

  function makeRow(kind) {
    const row = document.createElement("p");
    const label = document.createElement("span");
    const text = document.createElement("span");
    row.dataset.caption = kind;
    label.className = "meet-dual-captions__label";
    row.append(label, text);
    return { row, label, text };
  }

  function applyCaptionSettings(value) {
    captionSettings = normalizeCaptionSettings(value);
    if (!overlay) return;
    overlay.dataset.alignment = captionSettings.alignment;
    if (!displayedPair) return;
    for (const [element, language] of [
      [originalText.parentElement, displayedPair.original.language],
      [translationText.parentElement, displayedPair.translation.language],
    ]) {
      const style = captionStyleForLanguage(captionSettings, language);
      element.style.color = style.color;
      element.style.fontSize = `${style.size}px`;
    }
  }

  function ensureOverlay() {
    if (overlay?.isConnected) return;

    const original = makeRow("original");
    const translation = makeRow("translation");
    overlay = document.createElement("section");
    overlay.id = OVERLAY_ID;
    overlay.hidden = true;
    overlay.setAttribute("role", "log");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-atomic", "true");
    overlay.append(original.row, translation.row);
    document.body.append(overlay);
    originalText = original.text;
    translationText = translation.text;
    originalLabel = original.label;
    translationLabel = translation.label;
    applyCaptionSettings(captionSettings);
  }

  function ensureHistoryPanel() {
    if (historyPanel?.isConnected) return;

    const heading = document.createElement("h2");
    const note = document.createElement("span");
    const header = document.createElement("header");
    historyPanel = document.createElement("aside");
    historyList = document.createElement("ol");
    historyCount = document.createElement("span");
    historyEmpty = document.createElement("p");
    heading.id = `${HISTORY_PANEL_ID}-title`;
    heading.textContent = "Histórico temporário";
    note.textContent = "Somente nesta aba";
    historyCount.textContent = "0 falas";
    historyEmpty.textContent = "As falas aparecerão aqui.";
    header.append(heading, note, historyCount);
    historyPanel.id = HISTORY_PANEL_ID;
    historyPanel.hidden = true;
    historyPanel.setAttribute("aria-labelledby", heading.id);
    historyPanel.append(header, historyEmpty, historyList);
    document.documentElement.append(historyPanel);
    updateHistoryMovement = attachHistoryMovement(historyPanel, header);
  }

  function updateHistoryPanelVisibility() {
    if (!historyPanel && !historyEnabled) return;
    ensureHistoryPanel();
    historyPanel.hidden = !(enabled && historyEnabled);
    updateHistoryMovement();
    if (!historyPanel.hidden) {
      for (let index = 0; index < captionHistory.length; index += 1) renderHistoryEntry(index);
    }
  }

  function renderHistoryEntry(index) {
    ensureHistoryPanel();
    const entry = captionHistory[index];
    if (!entry) return;
    const shouldStick = historyList.scrollHeight - historyList.scrollTop
      - historyList.clientHeight < 32;
    let item = historyList.children[index];
    if (!item) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      const speaker = document.createElement("strong");
      const phrase = document.createElement("span");
      const translation = document.createElement("p");
      const translationLabel = document.createElement("span");
      const translationTextValue = document.createElement("span");
      item = document.createElement("li");
      speaker.dataset.historySpeaker = "";
      phrase.dataset.historyPhrase = "";
      translationLabel.className = "meet-dual-history__translation-label";
      translationLabel.textContent = "Tradução";
      translationTextValue.dataset.historyTranslation = "";
      translation.append(translationLabel, translationTextValue);
      summary.append(speaker, phrase);
      details.append(summary, translation);
      const showTranslation = () => {
        requestHistoryTranslation(index);
        requestAnimationFrame(() => keepHistoryEntryVisible(index));
      };
      details.addEventListener("mouseenter", showTranslation);
      details.addEventListener("focusin", showTranslation);
      details.addEventListener("toggle", () => {
        if (details.open) showTranslation();
      });
      item.append(details);
      historyList.append(item);
    }

    item.querySelector("[data-history-speaker]").textContent = entry.speaker;
    const phrase = item.querySelector("[data-history-phrase]");
    const translation = item.querySelector("[data-history-translation]");
    phrase.textContent = entry.sourceText;
    phrase.lang = entry.sourceLanguage === "pt" ? "pt-BR" : "en";
    translation.lang = entry.sourceLanguage === "pt" ? "en" : "pt-BR";
    const status = historyTranslationStatus.get(index);
    translation.textContent = entry.translation
      || (status === "error" ? "Não foi possível traduzir. Tente novamente." : "Tradução em andamento…");
    historyEmpty.hidden = captionHistory.length > 0;
    historyCount.textContent = captionHistory.length === 1
      ? "1 fala"
      : `${captionHistory.length} falas`;
    if (shouldStick) historyList.scrollTop = historyList.scrollHeight;
  }

  function recordCaptionHistory(value) {
    if (!historyEnabled) return;
    const index = upsertCaptionHistory(captionHistory, value);
    if (index !== null) {
      if (captionHistory[index].translation) historyTranslationStatus.delete(index);
      renderHistoryEntry(index);
    }
  }

  function resetCaptionHistory(ignoreExistingBlocks = false) {
    captionHistory.length = 0;
    captionBlockHistory = new WeakMap();
    ignoredCaptionBlocks = new WeakMap();
    if (ignoreExistingBlocks) {
      for (const block of queryAllAccessible(document, ".nMcdL")) {
        ignoredCaptionBlocks.set(block, normalizeCaption(block.textContent));
      }
    }
    captionHistorySerial = 0;
    historyMeetingRevision += 1;
    historyTranslationSerial = 0;
    historyTranslationStatus.clear();
    historyList?.replaceChildren();
    if (historyCount) historyCount.textContent = "0 falas";
    if (historyEmpty) historyEmpty.hidden = false;
  }

  function historyEntryIsEngaged(index) {
    const details = historyList?.children[index]?.querySelector("details");
    return Boolean(
      details
      && (details.open || details.matches(":hover") || details.contains(document.activeElement))
    );
  }

  function keepHistoryEntryVisible(index) {
    const details = historyList?.children[index]?.querySelector("details");
    if (!details) return;
    const itemRect = details.getBoundingClientRect();
    const listRect = historyList.getBoundingClientRect();
    if (itemRect.bottom > listRect.bottom) {
      historyList.scrollTop += itemRect.bottom - listRect.bottom;
    } else if (itemRect.top < listRect.top) {
      historyList.scrollTop -= listRect.top - itemRect.top;
    }
  }

  function requestHistoryTranslation(index) {
    const entry = captionHistory[index];
    const currentStatus = historyTranslationStatus.get(index);
    if (!entry || entry.translation || (currentStatus && currentStatus !== "error")) return;
    const requestId = `history-${++historyTranslationSerial}`;
    historyTranslationStatus.set(index, requestId);
    renderHistoryEntry(index);
    keepHistoryEntryVisible(index);
    const request = {
      requestId,
      kind: "history",
      historyIndex: index,
      meetingRevision: historyMeetingRevision,
      sourceText: entry.sourceText,
      sourceLanguage: entry.sourceLanguage,
    };
    translationRequests.set(requestId, request);
    translationScheduler.enqueue(request);
  }

  function completeHistoryTranslation(request, value) {
    if (
      request.meetingRevision !== historyMeetingRevision
      || historyTranslationStatus.get(request.historyIndex) !== request.requestId
    ) return;
    const entry = captionHistory[request.historyIndex];
    if (!historyRequestMatches(entry, request)) {
      retryLatestHistoryTranslation(request);
      return;
    }
    entry.translation = normalizeHistoryText(value);
    if (!entry.translation) {
      failHistoryTranslation(request);
      return;
    }
    historyTranslationStatus.delete(request.historyIndex);
    renderHistoryEntry(request.historyIndex);
    if (historyEntryIsEngaged(request.historyIndex)) keepHistoryEntryVisible(request.historyIndex);
  }

  function failHistoryTranslation(request) {
    if (
      request.meetingRevision !== historyMeetingRevision
      || historyTranslationStatus.get(request.historyIndex) !== request.requestId
    ) return;
    if (!historyRequestMatches(captionHistory[request.historyIndex], request)) {
      retryLatestHistoryTranslation(request);
      return;
    }
    historyTranslationStatus.set(request.historyIndex, "error");
    renderHistoryEntry(request.historyIndex);
    if (historyEntryIsEngaged(request.historyIndex)) keepHistoryEntryVisible(request.historyIndex);
  }

  function retryLatestHistoryTranslation(request) {
    historyTranslationStatus.delete(request.historyIndex);
    renderHistoryEntry(request.historyIndex);
    if (historyEntryIsEngaged(request.historyIndex)) {
      requestHistoryTranslation(request.historyIndex);
    }
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function hasSignificantCaptionText(text) {
    const normalized = normalizeCaption(text);
    return normalized.length > 3;
  }

  function isLikelyCaptionRegion(region) {
    if (!region) return false;
    const rect = region.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 8) return false;

    const style = getComputedStyle(region);
    if (!isCaptionStyleVisible(style)) return false;

    if (!hasSignificantCaptionText(region.textContent)) return false;

    if (rect.top > window.innerHeight * 0.35 && rect.top < window.innerHeight + 100) return true;
    return false;
  }

  function inferRole(element) {
    if (element.matches(".nMcdL")) {
      return captionRoleFromSpeakerLabel(element.querySelector(".NWpY1d")?.textContent);
    }
    const metadataElement = element.closest("[aria-label], [data-caption-type], [data-language-type]");
    const metadata = metadataElement
      ? [
        metadataElement.getAttribute("aria-label"),
        metadataElement.getAttribute("data-caption-type"),
        metadataElement.getAttribute("data-language-type"),
      ].filter(Boolean).join(" ").toLowerCase()
      : "";

    if (/translat|traduz/u.test(metadata)) return "translation";
    if (/original|spoken|falad/u.test(metadata)) return "original";
    return null;
  }

  function historyEntryId(element) {
    if (!element.matches(".nMcdL")) return undefined;
    const ignoredText = ignoredCaptionBlocks.get(element);
    if (ignoredText !== undefined) {
      if (ignoredText === normalizeCaption(element.textContent)) return undefined;
      ignoredCaptionBlocks.delete(element);
    }
    let entryId = captionBlockHistory.get(element);
    if (entryId === undefined) {
      entryId = ++captionHistorySerial;
      captionBlockHistory.set(element, entryId);
    }
    return entryId;
  }

  function candidateFrom(element, order, translatedLanguage) {
    const languageElement = element.closest("[lang], [data-language-code]");
    const role = inferRole(element);
    const captionBody = element.matches(".nMcdL") ? element.querySelector(".ygicle") : null;
    const speakerLabel = element.matches(".nMcdL")
      ? element.querySelector(".NWpY1d")?.textContent
      : "";
    const spokenText = captionBody
      ? latestCaptionText([...captionBody.childNodes].map((node) => node.textContent))
      : element.textContent;
    const caption = captionSpeakerAndText(spokenText, speakerLabel);
    const historyCaption = {
      speaker: caption.speaker,
      text: normalizeHistoryText(captionBody?.textContent || spokenText),
    };
    return {
      text: caption.text,
      historyText: historyCaption.text,
      speaker: caption.speaker,
      entryId: historyEntryId(element),
      lang: role === "translation"
        ? translatedLanguage
        : languageElement?.getAttribute("lang") || languageElement?.getAttribute("data-language-code"),
      role,
      visible: isVisible(element),
      order,
    };
  }

  function collectCandidates(region) {
    const root = region.shadowRoot || region;
    const translatedLanguage = selectedTranslatedLanguage(document);
    const hasLanguageHints = region.querySelectorAll("[lang], [data-language-code]").length > 0;
    const meetCaptionBlocks = queryAllAccessible(root, ".nMcdL");
    let elements = meetCaptionBlocks.length
      ? meetCaptionBlocks
      : hasLanguageHints
        ? queryAllAccessible(root, "[lang], [data-language-code]")
        : [
          ...queryAllAccessible(root, "*").filter((element) => {
            const text = normalizeCaption(element.textContent);
            return element.children.length === 0
              && !element.closest("button, [role='button']")
              && hasSignificantCaptionText(text)
              && !isCaptionUiText(text);
          }),
        ];

    if (!elements.length) elements = [region];
    return elements
      .filter((element) => !element.closest(`#${OVERLAY_ID}`))
      .filter((element) => !isCaptionUiText(element.textContent))
      .map((element, order) => candidateFrom(element, order, translatedLanguage));
  }

  function findCaptionRegion() {
    const explicitRegions = queryAllAccessible(document, CAPTION_REGION_SELECTOR);
    const explicitRegion = pickCaptionRegion(explicitRegions);
    if (explicitRegion) return explicitRegion;

    const fallbackRegions = queryAllAccessible(document, CAPTION_FALLBACK_SELECTOR)
      .filter(isLikelyCaptionRegion);
    return pickCaptionRegion(fallbackRegions);
  }

  function ensureTranslator() {
    if (translatorRequested) return;
    translatorRequested = true;
    updateDebugState({ translatorState: "loading" });
    chrome.runtime.sendMessage({ target: "background", type: "ensure" })
      .then((response) => {
        if (response?.ok === false) throw new Error(response.error);
        updateDebugState({ backgroundState: "ready" });
      })
      .catch((error) => {
        translatorRequested = false;
        reportTranslatorError(error);
      });
  }

  function reportTranslatorError(error) {
    const message = error?.message || String(error);
    updateDebugState({ translatorState: "error", translatorError: message });
    if (translationText) translationText.textContent = `Erro no tradutor: ${message}`;
  }

  function postTranslation(request) {
    ensureTranslator();
    if (translatorReady) translationStartedAt.set(request.requestId, performance.now());
    chrome.runtime.sendMessage({
      target: "background",
      type: "translate",
      request,
    })
      .then((response) => {
        if (response?.ok === false) throw new Error(response.error);
        if (response?.type === "result") handleTranslatorMessage(response);
      })
      .catch((error) => {
        const queuedRequest = translationRequests.get(request.requestId);
        finishTranslation(request.requestId);
        if (queuedRequest?.kind === "history") {
          failHistoryTranslation(queuedRequest);
          return;
        }
        reportTranslatorError(error);
      });
  }

  function finishTranslation(requestId) {
    translationRequests.delete(requestId);
    translationStartedAt.delete(requestId);
    translationScheduler.finish(requestId);
  }

  function dropTranslation(request) {
    translationRequests.delete(request.requestId);
    translationStartedAt.delete(request.requestId);
    if (request.kind === "history") failHistoryTranslation(request);
  }

  translationScheduler = createLatestOnlyScheduler(postTranslation, dropTranslation);

  function requestTranslation(sourceText, sourceLanguage, region, source) {
    const requestId = ++translationSerial;
    lastRequestedText = sourceText;
    const request = {
      requestId,
      sourceText,
      sourceLanguage,
      entryId: source?.entryId,
      speaker: source?.speaker,
      historyText: source?.historyText,
    };
    translationRequests.set(requestId, { ...request, region });
    translationScheduler.enqueue(request);
    return requestId;
  }

  function handleTranslatorMessage(message) {
    if (message?.target !== "content" || message?.source !== TRANSLATOR_SOURCE) return;
    if (message.type === "background-ready") {
      updateDebugState({ backgroundState: "ready" });
      return;
    }
    if (message.type === "host-loaded") {
      updateDebugState({ translatorHostState: "loaded" });
      return;
    }
    if (message.type === "ready") {
      translatorReady = true;
      updateDebugState({ translatorState: "ready", translatorWarmupMs: message.warmupMs });
      return;
    }
    if (message.type === "error") {
      const request = message.requestId
        ? translationRequests.get(message.requestId)
        : null;
      if (request?.kind === "history") {
        finishTranslation(message.requestId);
        failHistoryTranslation(request);
        return;
      }
      const isLatest = !message.requestId || message.requestId === translationSerial;
      if (message.requestId) finishTranslation(message.requestId);
      if (!isLatest) return;
      reportTranslatorError(message.error);
      return;
    }
    if (message.type !== "result") return;

    const request = translationRequests.get(message.requestId);
    const started = translationStartedAt.get(message.requestId);
    finishTranslation(message.requestId);
    if (!request || !enabled) return;
    const translated = normalizeCaption(message.translation);
    if (!translated) return;
    if (request.kind === "history") {
      completeHistoryTranslation(request, translated);
      return;
    }
    const historySourceText = request.historyText || request.sourceText;
    if (
      historyEnabled
      && request.entryId !== undefined
      && historySourceText === request.sourceText
    ) {
      recordCaptionHistory({
        entryId: request.entryId,
        requestId: request.requestId,
        speaker: request.speaker,
        sourceText: historySourceText,
        sourceLanguage: request.sourceLanguage,
        translation: translated,
      });
    }
    if (message.requestId !== translationSerial) return;
    const latency = started === undefined ? message.processingMs : performance.now() - started;
    translationLatencies = [...translationLatencies, latency].slice(-20);
    const summary = window.meetDualMetrics?.summarizeLatencies(translationLatencies);
    lastPair = captionPairFromTranslation(request.sourceText, request.sourceLanguage, translated);
    lastPairSourceText = request.sourceText;
    if (request.region.isConnected) showPair(lastPair, request.region);
    updateDebugState({
      pairFound: true,
      translationLatencyMs: Math.round(latency),
      translationEngineMs: message.processingMs,
      translationP95Ms: summary?.p95 ?? null,
      translationBudgetPassed: summary?.passes ?? false,
      translatorState: "ready",
    });
  }

  chrome.runtime.onMessage.addListener(handleTranslatorMessage);
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.target !== "content" || message?.source !== "meet-dual-popup") return false;
    if (message.type === "set-state") {
      if (typeof message.state?.enabled === "boolean") setEnabled(message.state.enabled);
      if (typeof message.state?.historyEnabled === "boolean") {
        setHistoryEnabled(message.state.historyEnabled);
      }
    }
    sendResponse({ ok: true, state: { enabled, historyEnabled } });
    return false;
  });

  function languageName(language) {
    return language === "pt" ? "Português" : "English";
  }

  function positionOverlay(region) {
    ensureOverlay();
    const { left, bottom, width } = captionPlacement(
      region.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
    );
    if (!width) return;
    overlay.style.left = `${left}px`;
    overlay.style.bottom = `${bottom}px`;
    overlay.style.width = `${width}px`;
    overlay.style.transform = "none";
  }

  function hideNativeCaptions(region) {
    if (nativeRegion && nativeRegion !== region) {
      nativeRegion.removeAttribute("data-meet-dual-captions-native");
    }
    nativeRegion = region;
    nativeRegion.setAttribute("data-meet-dual-captions-native", "");
  }

  function showPair(pair, region) {
    ensureOverlay();
    displayedPair = pair;
    applyCaptionSettings(captionSettings);
    positionOverlay(region);
    const nextOriginalLabel = `${languageName(pair.original.language)}: `;
    const nextTranslationLabel = `${languageName(pair.translation.language)}: `;
    updateCaptionText(originalText, pair.original.text,
      lastSourceLanguage === "pt" && originalLabel.textContent === nextOriginalLabel);
    updateCaptionText(translationText, pair.translation.text,
      lastSourceLanguage === "en" && translationLabel.textContent === nextTranslationLabel);
    originalLabel.textContent = nextOriginalLabel;
    translationLabel.textContent = nextTranslationLabel;
    overlay.hidden = false;
  }

  function updateCaptionText(element, nextText, incremental) {
    if (!incremental || !element.firstChild || element.childNodes.length !== 1) {
      element.textContent = nextText;
      return;
    }
    const patch = incrementalTextPatch(element.textContent, nextText);
    element.firstChild.replaceData(patch.start, patch.deleteCount, patch.insert);
  }

  function showNativeCaptions() {
    if (nativeRegion) nativeRegion.removeAttribute("data-meet-dual-captions-native");
    nativeRegion = null;
    if (overlay) overlay.hidden = true;
  }

  function refresh() {
    if (meetingPathChanged(historyMeetingPath, window.location.pathname)) {
      historyMeetingPath = window.location.pathname;
      resetTranslationState();
      resetCaptionHistory(true);
      return;
    }
    ensureMenuToggle();
    if (!enabled) {
      showNativeCaptions();
      updateDebugState({ enabled: false, pairFound: false, displayingLastPair: false });
      return;
    }
    ensureInstantCaptionMode();

    const region = findCaptionRegion();
    if (!region) {
      updateDebugState({ hasRegion: false, pairFound: false, displayingLastPair: false, candidates: 0 });
      showNativeCaptions();
      return;
    }

    const liveCandidates = collectCandidates(region);
    const meetingLanguage = selectedMeetingLanguage(document) || lastSourceLanguage;
    if (historyEnabled) {
      for (const candidate of liveCandidates) {
        if (candidate.entryId === undefined || candidate.role === "translation") continue;
        recordCaptionHistory({
          entryId: candidate.entryId,
          speaker: candidate.speaker,
          sourceText: candidate.historyText || candidate.text,
          sourceLanguage: detectSourceLanguage(candidate, meetingLanguage),
        });
      }
    }
    const source = pickSourceCaption(liveCandidates);
    if (source) {
      const sourceLanguage = detectSourceLanguage(source, meetingLanguage);
      lastSourceLanguage = sourceLanguage;
      const hasCurrentTranslation = lastPair && lastPairSourceText === source.text;
      const displayedPair = hasCurrentTranslation
        ? lastPair
        : captionPairFromTranslation(
          source.text,
          sourceLanguage,
          generatedCaptionText(lastPair, sourceLanguage),
        );
      hideNativeCaptions(region);
      showPair(displayedPair, region);
      let requestId = translationSerial;
      if (source.text !== lastRequestedText) {
        requestId = requestTranslation(source.text, sourceLanguage, region, source);
      }
      const sourceHistoryText = source.historyText || source.text;
      if (source.entryId !== undefined) {
        recordCaptionHistory({
          entryId: source.entryId,
          requestId,
          speaker: source.speaker,
          sourceText: sourceHistoryText,
          sourceLanguage,
          translation: hasCurrentTranslation && sourceHistoryText === source.text
            ? generatedCaptionText(lastPair, sourceLanguage)
            : "",
        });
      }
      updateDebugState({
        enabled: true,
        hasRegion: true,
        pairFound: Boolean(hasCurrentTranslation),
        displayingLastPair: false,
        candidates: liveCandidates.length,
        liveCandidates: liveCandidates.length,
        rememberedCandidates: 0,
        sourceLanguage,
        meetingLanguage,
        sourceText: source.text,
        historyEntries: captionHistory.length,
        regionInfo: region.id || region.className || region.getAttribute("aria-label") || region.getAttribute("jscontroller"),
      });
      return;
    }

    showNativeCaptions();
    updateDebugState({
      enabled: true,
      hasRegion: true,
      pairFound: false,
      displayingLastPair: false,
      candidates: liveCandidates.length,
      liveCandidates: liveCandidates.length,
      rememberedCandidates: 0,
      regionInfo: region.id || region.className || region.getAttribute("aria-label") || region.getAttribute("jscontroller"),
    });
  }

  ensureOverlay();
  chrome.storage.local.get(SETTINGS_KEY)
    .then((stored) => applyCaptionSettings(stored[SETTINGS_KEY]))
    .catch(() => applyCaptionSettings());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SETTINGS_KEY]) {
      applyCaptionSettings(changes[SETTINGS_KEY].newValue);
    }
  });
  if (enabled) ensureTranslator();
  let refreshQueued = false;
  const queueRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refresh();
    });
  };

  new MutationObserver(queueRefresh).observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  queueRefresh();
})();
