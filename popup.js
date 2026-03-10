document.addEventListener("DOMContentLoaded", async () => {
  const serviceEl = document.getElementById("service");
  const targetEl = document.getElementById("targetLang");
  const sourceEl = document.getElementById("sourceLang");
  const optionsLink = document.getElementById("openOptions");

  const { translateConfig = {} } = await chrome.storage.sync.get("translateConfig");

  serviceEl.value = translateConfig.service || "google";
  targetEl.value = translateConfig.targetLang || "zh-CN";
  sourceEl.value = translateConfig.sourceLang || "auto";

  function save() {
    chrome.storage.sync.get("translateConfig", ({ translateConfig: current = {} }) => {
      current.service = serviceEl.value;
      current.targetLang = targetEl.value;
      current.sourceLang = sourceEl.value;
      chrome.storage.sync.set({ translateConfig: current });
    });
  }

  serviceEl.addEventListener("change", save);
  targetEl.addEventListener("change", save);
  sourceEl.addEventListener("change", save);

  optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
