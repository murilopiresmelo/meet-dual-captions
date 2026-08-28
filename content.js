(function () {
  "use strict";

  const OVERLAY_ID = "meet-dual-captions";
  const MENU_TOGGLE_ID = "meet-dual-captions-toggle";
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

  function normalizeCaption(value) {
    return typeof value === "string"
      ? value.replace(/\s+/g, " ").trim().slice(0, 1000)
      : "";
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

    const enqueue = (item) => {
      if (active) {
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
        if (!pending) return;
        const next = pending;
        pending = null;
        enqueue(next);
      },
      reset() {
        if (pending) drop(pending);
        active = null;
        pending = null;
      },
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      captionPairFromTranslation,
      captionRoleFromSpeakerLabel,
      captionPlacement,
      createLatestOnlyScheduler,
      detectLanguage,
      detectSourceLanguage,
      generatedCaptionText,
      incrementalTextPatch,
      isCaptionUiText,
      isCaptionStyleVisible,
      isCaptionElement,
      isTranslatedCaptionType,
      latestCaptionText,
      normalizeCaption,
      pairCaptions,
      pickCaptionRegion,
      pickSourceCaption,
      readEnabled,
      selectDisplayedPair,
      selectedMeetingLanguage,
      selectedTranslatedLanguage,
      toggleText,
    };
    return;
  }

  const { captionStyleForLanguage, normalizeCaptionSettings } = globalThis.meetDualSettings;
  let enabled = readEnabled(window.localStorage);
  let captionSettings = normalizeCaptionSettings();
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
  let debugState = {
    version: "0.5.0",
    build: "bergamot-local-en-pt",
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

  function updateMenuToggle(item = document.getElementById(MENU_TOGGLE_ID)) {
    if (!item) return;
    item.setAttribute("aria-checked", String(enabled));
    item.setAttribute("aria-label", toggleText(enabled));
    item.querySelector("[data-meet-dual-captions-toggle-label]").textContent = toggleText(enabled);
  }

  function setEnabled(nextEnabled) {
    enabled = nextEnabled;
    if (!enabled) {
      translationSerial += 1;
      lastPair = null;
      lastPairSourceText = "";
      lastRequestedText = "";
      translationRequests.clear();
      translationStartedAt.clear();
      translationScheduler?.reset();
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // The control still works for this tab when storage is unavailable.
    }
    updateMenuToggle();
    refresh();
  }

  function ensureMenuToggle() {
    if (document.getElementById(MENU_TOGGLE_ID)) return;

    const menuItems = [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')];
    const settingsPattern = /^(configurações|settings)$/iu;
    const settingsItem = menuItems.find((item) => matchingTextNodes(item, settingsPattern).length);
    if (!settingsItem) return;

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
    const labelNode = labels[labels.length - 1];
    if (!labelNode) return;
    if (labels.length > 1 && normalizeCaption(labels[0].nodeValue).toLowerCase() === "settings") {
      labels[0].nodeValue = "closed_caption";
    }

    const label = document.createElement("span");
    label.setAttribute("data-meet-dual-captions-toggle-label", "");
    labelNode.replaceWith(label);
    item.id = MENU_TOGGLE_ID;
    item.setAttribute("role", "menuitemcheckbox");

    const toggle = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setEnabled(!enabled);
    };
    item.addEventListener("click", toggle, true);
    item.addEventListener("keydown", (event) => {
      if (item.tagName !== "BUTTON" && (event.key === "Enter" || event.key === " ")) toggle(event);
    }, true);
    updateMenuToggle(item);
    settingsItem.before(item);
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

  function candidateFrom(element, order, translatedLanguage) {
    const languageElement = element.closest("[lang], [data-language-code]");
    const role = inferRole(element);
    const spokenText = element.matches(".nMcdL")
      ? latestCaptionText([...element.querySelector(".ygicle")?.childNodes || []]
        .map((node) => node.textContent))
      : element.textContent;
    return {
      text: spokenText,
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
    const seen = new Set();

    return elements
      .filter((element) => !element.closest(`#${OVERLAY_ID}`))
      .filter((element) => !isCaptionUiText(element.textContent))
      .filter((element) => {
        const key = `${element.tagName.toLowerCase()}|${normalizeCaption(element.textContent)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
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
        finishTranslation(request.requestId);
        reportTranslatorError(error);
      });
  }

  function finishTranslation(requestId) {
    translationRequests.delete(requestId);
    translationStartedAt.delete(requestId);
    translationScheduler.finish(requestId);
  }

  translationScheduler = createLatestOnlyScheduler(postTranslation, (request) => {
    translationRequests.delete(request.requestId);
    translationStartedAt.delete(request.requestId);
  });

  function requestTranslation(sourceText, sourceLanguage, region) {
    const requestId = ++translationSerial;
    lastRequestedText = sourceText;
    const request = { requestId, sourceText, sourceLanguage };
    translationRequests.set(requestId, { ...request, region });
    translationScheduler.enqueue(request);
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
    if (!request || message.requestId !== translationSerial || !enabled) return;
    const translated = normalizeCaption(message.translation);
    if (!translated) return;
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
    const source = pickSourceCaption(liveCandidates);
    if (source) {
      const meetingLanguage = selectedMeetingLanguage(document) || lastSourceLanguage;
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
      if (source.text !== lastRequestedText) requestTranslation(source.text, sourceLanguage, region);
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
