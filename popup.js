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
    const config = {
      service: serviceEl.value,
      targetLang: targetEl.value,
      sourceLang: sourceEl.value,
    };
    chrome.storage.sync.set({ translateConfig: config });
  }

  serviceEl.addEventListener("change", save);
  targetEl.addEventListener("change", save);
  sourceEl.addEventListener("change", save);

  optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
