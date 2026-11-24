/* =========================================================================
   Startseite – Rahmen für alle Zustände
   Cube-Weg : overview → cube → glacier
   Karten-Weg: overview → map → area → probe
   Inhalt von Karte bzw. Cube: mapview.js / cubeview.js / glacierview.js / probe.js
   ========================================================================= */
window.Home = (function () {
  const D = GLACIER_DATA;
  const ALL = ["overview", "cube", "glacier", "map", "area", "probe"];
  const BACK = { cube: "home", glacier: "cube", map: "home", area: "map", probe: "area" };
  let page, lastMode = null;

  function rotator() {
    const words = ["schmilzt.", "verschwindet.", "wird zu Wasser.", "verändert die Alpen."];
    const el = document.querySelector(".rotator");
    let i = 0;
    setInterval(() => {
      if (App.state.mode !== "overview") return;
      el.querySelector(".rot-word").classList.add("out");
      setTimeout(() => { i = (i + 1) % words.length; el.innerHTML = `<span class="rot-word">${words[i]}</span>`; }, 420);
    }, 2800);
  }

  function onRoute(s) {
    const mode = s.mode;
    ALL.forEach((m) => page.classList.toggle("state-" + m, m === mode));
    const g = s.glacier ? App.glacierById(s.glacier) : null;
    if (g) document.querySelectorAll(".t-gname").forEach((e) => (e.textContent = g.name));
    // Zeitleiste: im Cube-Modus läuft sie von selbst
    if (mode === "cube" && lastMode !== "cube") Timeline.play({ loop: true, fromStart: lastMode === "overview" });
    if (mode !== "cube" && lastMode === "cube") Timeline.stop();
    lastMode = mode;
  }

  function init() {
    page = App.$("page-home");
    rotator();
    App.$("back-btn").addEventListener("click", () => {
      const m = App.state.mode, to = BACK[m] || "home";
      App.go(to === "cube" || to === "map" || to === "home" ? to : `${to}/${App.state.glacier}`);
    });
    App.onChange((s, what) => {
      if (what === "route") onRoute(s);
      document.querySelectorAll(".t-year").forEach((e) => (e.textContent = s.year));
    });
  }

  return { init };
})();
