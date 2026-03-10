/* --- Google Translate --- */

async function googleTranslate(texts, from, to) {
  const results = [];
  for (const text of texts) {
    const params = new URLSearchParams({
      client: "gtx",
      sl: from === "auto" ? "auto" : from,
      tl: to,
      dt: "t",
      dj: "1",
      q: text,
    });
    const resp = await fetch(
      `https://translate.googleapis.com/translate_a/single?${params}`
    );
    if (!resp.ok) throw new Error(`Google Translate HTTP ${resp.status}`);
    const data = await resp.json();
    results.push((data.sentences || []).map((s) => s.trans || "").join(""));
  }
  return results;
}

/* --- Microsoft/Bing Translate --- */

const BING_LANG_MAP = {
  "zh-CN": "zh-Hans",
  "zh-TW": "zh-Hant",
  "zh-HK": "zh-Hant",
  mn: "mn-Cyrl",
  no: "nb",
  iw: "he",
  jw: "jv",
  tl: "fil",
};

let bingToken = null;
let bingTokenExp = 0;

async function fetchBingToken() {
  const now = Date.now() / 1000;
  if (bingToken && bingTokenExp - now > 30) return bingToken;
  const resp = await fetch("https://edge.microsoft.com/translate/auth", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    },
  });
  if (!resp.ok) throw new Error(`Bing auth HTTP ${resp.status}`);
  bingToken = await resp.text();
  try {
    const payload = JSON.parse(atob(bingToken.split(".")[1]));
    bingTokenExp = payload.exp || now + 600;
  } catch {
    bingTokenExp = now + 600;
  }
  return bingToken;
}

function toBingLang(code) {
  if (code === "auto") return "";
  return BING_LANG_MAP[code] || code;
}

async function microsoftTranslate(texts, from, to) {
  const token = await fetchBingToken();
  const url = new URL(
    "https://api-edge.cognitive.microsofttranslator.com/translate"
  );
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("to", toBingLang(to));
  const fromLang = toBingLang(from);
  if (fromLang) url.searchParams.set("from", fromLang);
  url.searchParams.set("includeSentenceLength", "true");

  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    },
    body: JSON.stringify(texts.map((t) => ({ Text: t }))),
  });

  if (resp.status === 401) {
    bingToken = null;
    bingTokenExp = 0;
    return microsoftTranslate(texts, from, to);
  }
  if (!resp.ok) throw new Error(`Bing Translate HTTP ${resp.status}`);

  const data = await resp.json();
  return data.map((item) => item.translations[0].text);
}

/* --- LLM Translation Prompt --- */

const LANG_NAMES = {
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  fr: "French",
  de: "German",
  es: "Spanish",
  ru: "Russian",
  pt: "Portuguese",
  it: "Italian",
  ar: "Arabic",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
  tr: "Turkish",
  pl: "Polish",
  nl: "Dutch",
  uk: "Ukrainian",
};

function buildPrompt(text, from, to) {
  const toLang = LANG_NAMES[to] || to;
  const fromHint =
    from && from !== "auto" ? ` from ${LANG_NAMES[from] || from}` : "";
  return `Translate the following text${fromHint} to ${toLang}. Output ONLY the translation, nothing else.\n\n${text}`;
}

/* --- Ollama (streaming) --- */

async function ollamaTranslateStream(text, from, to, config, onChunk) {
  const baseUrl = (config.url || "http://localhost:11434").replace(/\/+$/, "");
  const model = config.model || "translategemma:4b";

  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer ollama",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a translation engine, you can only translate text and cannot interpret it, and do not explain.",
        },
        { role: "user", content: buildPrompt(text, from, to) },
      ],
      temperature: 0,
      stream: true,
      keep_alive: "5m",
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Ollama HTTP ${resp.status}: ${errText}`);
  }
  await readSSEStream(resp.body, onChunk);
}

/* --- Poe (streaming) --- */

async function poeTranslateStream(text, from, to, config, onChunk) {
  const apiKey = config.apiKey || "";
  if (!apiKey) throw new Error("Poe API Key is not set. Go to Settings to configure.");
  const model = config.model || "gpt-5.3-codex";

  const resp = await fetch("https://api.poe.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a translation engine, you can only translate text and cannot interpret it, and do not explain.",
        },
        { role: "user", content: buildPrompt(text, from, to) },
      ],
      temperature: 0,
      stream: true,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Poe API HTTP ${resp.status}: ${errText}`);
  }
  await readSSEStream(resp.body, onChunk);
}

/* --- SSE Stream Reader --- */

async function readSSEStream(body, onChunk) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6);
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) onChunk(delta);
      } catch {}
    }
  }
}

/* --- Config --- */

const DEFAULT_CONFIG = {
  service: "google",
  targetLang: "zh-CN",
  sourceLang: "auto",
  ollama: { url: "http://localhost:11434", model: "translategemma:4b" },
  poe: { apiKey: "", model: "gpt-5.3-codex" },
};

async function getConfig() {
  const { translateConfig } = await chrome.storage.sync.get("translateConfig");
  return { ...DEFAULT_CONFIG, ...translateConfig };
}

/* --- Message Handler --- */

const STREAM_SERVICES = new Set(["ollama", "poe"]);

async function handleTranslate(request) {
  const config = await getConfig();
  const service = request.service || config.service;
  const from = request.from || config.sourceLang;
  const to = request.to || config.targetLang;
  const texts = Array.isArray(request.texts) ? request.texts : [request.text];

  switch (service) {
    case "google":
      return await googleTranslate(texts, from, to);
    case "microsoft":
      return await microsoftTranslate(texts, from, to);
    default:
      throw new Error(`Unknown service: ${service}`);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate") {
    handleTranslate(request)
      .then((results) => sendResponse({ ok: true, results }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (request.action === "getConfig") {
    getConfig().then((config) => sendResponse(config));
    return true;
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "translate-stream") return;

  port.onMessage.addListener(async (request) => {
    try {
      const config = await getConfig();
      const service = request.service || config.service;
      const from = request.from || config.sourceLang;
      const to = request.to || config.targetLang;
      const text = Array.isArray(request.texts) ? request.texts[0] : request.text;

      const onChunk = (chunk) => {
        try { port.postMessage({ type: "chunk", content: chunk }); } catch {}
      };

      if (service === "ollama") {
        await ollamaTranslateStream(text, from, to, config.ollama, onChunk);
      } else if (service === "poe") {
        await poeTranslateStream(text, from, to, config.poe, onChunk);
      }
      try { port.postMessage({ type: "done" }); } catch {}
    } catch (err) {
      try { port.postMessage({ type: "error", error: err.message }); } catch {}
    }
  });
});
