document.addEventListener("DOMContentLoaded", async () => {
  const ollamaUrlEl = document.getElementById("ollamaUrl");
  const ollamaModelEl = document.getElementById("ollamaModel");
  const ollamaRefreshBtn = document.getElementById("ollamaRefresh");
  const ollamaHelp = document.getElementById("ollamaModelHelp");
  const poeApiKeyEl = document.getElementById("poeApiKey");
  const poeModelEl = document.getElementById("poeModel");
  const toast = document.getElementById("toast");

  const { translateConfig = {} } = await chrome.storage.sync.get("translateConfig");
  const ol = translateConfig.ollama || {};
  const po = translateConfig.poe || {};

  ollamaUrlEl.value = ol.url || "http://localhost:11434";
  poeApiKeyEl.value = po.apiKey || "";
  poeModelEl.value = po.model || "gpt-5.3-codex";

  const savedModel = ol.model || "translategemma:4b";

  async function fetchOllamaModels() {
    const baseUrl = (ollamaUrlEl.value.trim() || "http://localhost:11434").replace(/\/+$/, "");
    ollamaHelp.textContent = "Fetching models…";
    ollamaRefreshBtn.disabled = true;

    try {
      const resp = await fetch(`${baseUrl}/api/tags`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const models = (data.models || []).map((m) => m.name || m.model);

      ollamaModelEl.innerHTML = "";
      if (models.length === 0) {
        ollamaHelp.textContent = "No models found. Run: ollama pull translategemma:4b";
        const opt = document.createElement("option");
        opt.value = savedModel;
        opt.textContent = savedModel;
        ollamaModelEl.appendChild(opt);
      } else {
        for (const name of models) {
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          ollamaModelEl.appendChild(opt);
        }
        ollamaHelp.textContent = `${models.length} model(s) available`;
      }

      if (models.includes(savedModel)) {
        ollamaModelEl.value = savedModel;
      } else if (ollamaModelEl.options.length > 0) {
        ollamaModelEl.selectedIndex = 0;
      }
    } catch (e) {
      ollamaModelEl.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = savedModel;
      opt.textContent = savedModel;
      ollamaModelEl.appendChild(opt);
      ollamaModelEl.value = savedModel;
      ollamaHelp.textContent = "Cannot connect to Ollama. Using saved model.";
    }

    ollamaRefreshBtn.disabled = false;
  }

  await fetchOllamaModels();
  ollamaRefreshBtn.addEventListener("click", fetchOllamaModels);

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const { translateConfig: current = {} } = await chrome.storage.sync.get("translateConfig");
      current.ollama = {
        url: ollamaUrlEl.value.trim() || "http://localhost:11434",
        model: ollamaModelEl.value || "translategemma:4b",
      };
      current.poe = {
        apiKey: poeApiKeyEl.value.trim(),
        model: poeModelEl.value.trim() || "gpt-5.3-codex",
      };
      await chrome.storage.sync.set({ translateConfig: current });
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 1500);
    }, 300);
  }

  ollamaUrlEl.addEventListener("input", () => {
    save();
    clearTimeout(ollamaUrlEl._refreshTimer);
    ollamaUrlEl._refreshTimer = setTimeout(fetchOllamaModels, 800);
  });
  ollamaModelEl.addEventListener("change", save);
  poeApiKeyEl.addEventListener("input", save);
  poeModelEl.addEventListener("input", save);
});
