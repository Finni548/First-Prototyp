/* =========================================================================
   Startseite – Rahmen für die drei Zustände
   overview : Karte gross links, Cube rechts (dreht sich)
   cube     : Cube gross, Karte bleibt blass oben links im Hintergrund
   glacier  : ein Gletscher in Jahres-Layers, oben links ein echtes Foto
   Der Inhalt des Cubes selbst steckt in cubeview.js
   ========================================================================= */
window.Home = (function () {
  const D = GLACIER_DATA;
  let mapStage, dio, page, lastMode = null;

  function rotator() {
    const words = ["schmilzt.", "verschwindet.", "wird zu Wasser.", "verändert die Alpen."];
    const el = document.querySelector(".rotator");
    let i = 0;
    setInterval(() => {
      if (App.state.page !== "home" || App.state.mode !== "overview") return;
      el.querySelector(".rot-word").classList.add("out");
      setTimeout(() => { i = (i + 1) % words.length; el.innerHTML = `<span class="rot-word">${words[i]}</span>`; }, 420);
    }, 2800);
  }

  function photo(g) {
    const img = App.$("glacier-photo"), ph = App.$("photo-placeholder");
    const path = `img/gletscher/${g.id}.jpg`;
    App.$("photo-path").textContent = path;
    App.$("photo-caption").textContent = `${g.name} · Kanton ${g.canton}`;
    img.alt = "Foto " + g.name;
    img.hidden = true; ph.hidden = false;
    img.onload = () => { img.hidden = false; ph.hidden = true; };
    img.onerror = () => { img.hidden = true; ph.hidden = false; };
    img.src = path;
  }

  function onRoute(s) {
    const mode = s.page === "home" ? s.mode : null;
    page.classList.remove("state-overview", "state-cube", "state-glacier");
    if (mode) page.classList.add("state-" + mode);
    mapStage.active = s.page === "home" && mode !== "glacier";

    if (mode === "glacier") {
      const g = App.glacierById(s.glacier);
      App.$("t-glacier-name").textContent = g.name;
      photo(g);
    }
    // Zeitleiste: im Cube-Modus läuft sie von selbst
    if (mode === "cube" && lastMode !== "cube") Timeline.play({ loop: true, fromStart: lastMode === "overview" });
    if (mode !== "cube" && lastMode === "cube") Timeline.stop();
    lastMode = mode;
  }

  function init() {
    page = App.$("page-home");
    rotator();

    // ---- Karte (links / blass im Hintergrund) ----
    mapStage = Scene3D.createStage(App.$("home-map-stage"), { fov: 28, theta: -0.3, phi: 0.9, radius: 17.5, target: [0, 0.35, 0] });
    dio = Scene3D.buildRelief({ glassH: 2.4 });
    mapStage.scene.add(dio.group);
    const panel = App.$("panel-map");
    let tilt = 0;
    panel.addEventListener("pointermove", (e) => { const r = panel.getBoundingClientRect(); tilt = (e.clientX - r.left) / r.width - 0.5; });
    panel.addEventListener("pointerleave", () => (tilt = 0));
    mapStage.onFrame = (dt) => { const o = mapStage.orbit; o.theta += ((-0.3 + tilt * 0.5) - o.theta) * Math.min(1, dt * 3); };
    panel.addEventListener("click", () => App.go("map"));
    panel.addEventListener("keydown", (e) => { if (e.key === "Enter") App.go("map"); });

    App.$("back-btn").addEventListener("click", () => App.go(App.state.mode === "glacier" ? "cube" : "home"));

    App.onChange((s, what) => {
      if (what === "route") onRoute(s);
      dio.setYear(s.year);
      App.$("t-cube-year").textContent = s.year;
    });
    dio.setYear(App.state.year);
  }

  return { init };
})();
