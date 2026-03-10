(() => {
  "use strict";

  const TRANSLATED_ATTR = "data-imt-translated";
  const TRANSLATION_TAG = "data-imt-translation";
  const INLINE_TAGS = new Set([
    "A", "ABBR", "ACRONYM", "B", "BDO", "BIG", "BR", "BUTTON", "CITE",
    "CODE", "DFN", "EM", "I", "IMG", "INPUT", "KBD", "LABEL", "MAP",
    "OBJECT", "OUTPUT", "Q", "SAMP", "SELECT", "SMALL", "SPAN", "STRONG",
    "SUB", "SUP", "TEXTAREA", "TIME", "TT", "U", "VAR", "FONT", "MARK",
    "RUBY", "RT", "RP", "WBR", "DATA",
  ]);
  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT",
    "SVG", "CANVAS", "VIDEO", "AUDIO", "IFRAME", "OBJECT", "EMBED",
    "CODE", "PRE", "KBD",
  ]);
  const MIN_TEXT_LENGTH = 4;

  let mouseX = 0;
  let mouseY = 0;

  function isVisible(el) {
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && parseFloat(style.opacity) > 0;
  }

  function getTextContent(el) {
    let text = "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (
        node.nodeType === Node.ELEMENT_NODE &&
        !node.hasAttribute(TRANSLATION_TAG) &&
        INLINE_TAGS.has(node.tagName)
      ) {
        text += getTextContent(node);
      }
    }
    return text;
  }

  function findParagraph(el) {
    let current = el;
    for (let i = 0; i < 10; i++) {
      if (!current || current === document.body || current === document.documentElement) return null;
      if (SKIP_TAGS.has(current.tagName)) return null;
      if (current.hasAttribute(TRANSLATION_TAG)) {
        current = current.parentElement;
        continue;
      }
      if (current.getAttribute(TRANSLATED_ATTR)) return null;

      const text = getTextContent(current).trim();
      if (text.length >= MIN_TEXT_LENGTH && !INLINE_TAGS.has(current.tagName)) {
        return current;
      }
      if (text.length >= MIN_TEXT_LENGTH && INLINE_TAGS.has(current.tagName) && current.parentElement) {
        const parent = current.parentElement;
        if (!SKIP_TAGS.has(parent.tagName) && !INLINE_TAGS.has(parent.tagName) && !parent.getAttribute(TRANSLATED_ATTR)) {
          return parent;
        }
      }
      current = current.parentElement;
    }
    return null;
  }

  const STREAM_SERVICES = new Set(["ollama", "poe"]);

  function translateElement(el) {
    if (!el || el.getAttribute(TRANSLATED_ATTR)) return;
    el.setAttribute(TRANSLATED_ATTR, "pending");

    const sourceText = getTextContent(el).trim();
    if (sourceText.length < MIN_TEXT_LENGTH) {
      el.removeAttribute(TRANSLATED_ATTR);
      return;
    }

    const isInline = INLINE_TAGS.has(el.tagName);
    const loadingEl = document.createElement(isInline ? "span" : "div");
    loadingEl.className = isInline ? "imt-target-inline imt-loading" : "imt-target-block imt-loading";
    loadingEl.setAttribute(TRANSLATION_TAG, "true");
    loadingEl.textContent = " ";
    el.appendChild(loadingEl);

    chrome.runtime.sendMessage({ action: "getConfig" }, (config) => {
      if (chrome.runtime.lastError || !config) {
        loadingEl.remove();
        showError(el, chrome.runtime.lastError?.message || "Cannot get config");
        return;
      }

      const service = config.service || "google";

      if (STREAM_SERVICES.has(service)) {
        translateStream(el, loadingEl, sourceText, service);
      } else {
        translateNonStream(el, loadingEl, sourceText);
      }
    });
  }

  function translateStream(el, loadingEl, sourceText) {
    const port = chrome.runtime.connect({ name: "translate-stream" });
    let accumulated = "";

    port.onMessage.addListener((msg) => {
      if (msg.type === "chunk") {
        accumulated += msg.content;
        loadingEl.textContent = accumulated;
        loadingEl.classList.remove("imt-loading");
      } else if (msg.type === "done") {
        if (!accumulated) {
          loadingEl.remove();
          showError(el, "Empty translation result");
        } else {
          loadingEl.textContent = accumulated.trim();
          el.setAttribute(TRANSLATED_ATTR, "done");
        }
        port.disconnect();
      } else if (msg.type === "error") {
        loadingEl.remove();
        showError(el, msg.error);
        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      if (el.getAttribute(TRANSLATED_ATTR) === "pending" && !accumulated) {
        loadingEl.remove();
        showError(el, "Connection lost");
      }
    });

    port.postMessage({ action: "translate", texts: [sourceText] });
  }

  function translateNonStream(el, loadingEl, sourceText) {
    chrome.runtime.sendMessage(
      { action: "translate", texts: [sourceText] },
      (response) => {
        if (chrome.runtime.lastError) {
          loadingEl.remove();
          showError(el, chrome.runtime.lastError.message);
          return;
        }
        if (!response || response.error) {
          loadingEl.remove();
          showError(el, response ? response.error : "No response");
          return;
        }
        if (response.results && response.results[0]) {
          loadingEl.textContent = response.results[0];
          loadingEl.classList.remove("imt-loading");
          el.setAttribute(TRANSLATED_ATTR, "done");
        } else {
          loadingEl.remove();
          showError(el, "Empty translation result");
        }
      }
    );
  }

  function showError(parentEl, message) {
    parentEl.setAttribute(TRANSLATED_ATTR, "error");
    const wrapper = document.createElement("div");
    wrapper.className = "imt-error";
    wrapper.setAttribute(TRANSLATION_TAG, "true");
    wrapper.textContent = "\u26A0 " + message;
    parentEl.appendChild(wrapper);

    setTimeout(() => {
      wrapper.remove();
      parentEl.removeAttribute(TRANSLATED_ATTR);
    }, 5000);
  }

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  let ctrlCombo = false;

  document.addEventListener("keydown", (e) => {
    if (e.key === "Control") {
      if (!e.repeat) ctrlCombo = false;
      return;
    }
    if (e.ctrlKey || e.metaKey) ctrlCombo = true;
  });

  document.addEventListener("keyup", (e) => {
    if (e.key !== "Control" || ctrlCombo) return;

    const target = document.elementFromPoint(mouseX, mouseY);
    if (!target) return;

    const translated = target.closest(`[${TRANSLATED_ATTR}="done"]`);
    if (translated) {
      translated.querySelectorAll(`[${TRANSLATION_TAG}]`).forEach((el) => el.remove());
      translated.removeAttribute(TRANSLATED_ATTR);
      return;
    }

    const paragraph = findParagraph(target);
    if (paragraph && isVisible(paragraph)) {
      translateElement(paragraph);
    }
  });
})();
