(() => {
  const root = document.documentElement;
  const storageKey = "economics-microsite-appearance";
  const themes = ["dark", "light"];
  const sizes = ["small", "medium", "large"];
  const controls = {
    light: document.getElementById("appearance-light"),
    dark: document.getElementById("appearance-dark"),
    size: document.getElementById("appearance-size"),
    status: document.getElementById("appearance-status"),
  };
  let settings = { theme: "dark", size: "medium" };

  function reportStorageError(error) {
    console.error("Could not save or load appearance preferences", error);
    controls.status.textContent = "Appearance preferences cannot be saved in this browser.";
    controls.status.hidden = false;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && themes.includes(saved.theme) && sizes.includes(saved.size)) settings = saved;
  } catch (error) {
    reportStorageError(error);
  }

  function applyFrame(frame, loaded = false) {
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.head || !doc.documentElement) {
        if (loaded) throw new Error("Embedded page is not accessible.");
        return;
      }
      doc.documentElement.dataset.appearance = settings.theme;
      doc.dispatchEvent(new Event("microsite-appearance-change"));
      if (!doc.getElementById("microsite-appearance-style")) {
        const link = doc.createElement("link");
        link.id = "microsite-appearance-style";
        link.rel = "stylesheet";
        link.href = new URL("appearance.css?v=20261126-7", document.baseURI).href;
        link.addEventListener("error", () => {
          console.error("Could not load appearance styles in", frame.title);
          controls.status.textContent = "Appearance could not be applied to an embedded page.";
          controls.status.hidden = false;
        });
        doc.head.append(link);
      }
    } catch (error) {
      console.error("Could not apply appearance to", frame.title, error);
      controls.status.textContent = "Appearance could not be applied to an embedded page.";
      controls.status.hidden = false;
    }
  }

  function apply() {
    root.dataset.appearance = settings.theme;
    root.dataset.fontSize = settings.size;
    controls.light.setAttribute("aria-pressed", String(settings.theme === "light"));
    controls.dark.setAttribute("aria-pressed", String(settings.theme === "dark"));
    controls.size.value = settings.size;
    document.querySelectorAll(".forecast-frame").forEach(frame => applyFrame(frame));
  }

  function change(theme = settings.theme) {
    settings = { theme, size: controls.size.value };
    apply();
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (error) {
      reportStorageError(error);
    }
  }

  controls.light.addEventListener("click", () => change("light"));
  controls.dark.addEventListener("click", () => change("dark"));
  controls.size.addEventListener("change", () => change());
  document.querySelectorAll(".forecast-frame").forEach(frame => frame.addEventListener("load", () => applyFrame(frame, true)));
  apply();
})();
