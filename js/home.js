/* =========================================================================
   Startseite – Rahmen für alle Zustände
   Cube-Weg : overview → cube → glacier
   Karten-Weg: overview → map → area → probe
   Jede Ansicht hat denselben Kopf: Zurück + Pfad, Titel, ein erklärender Satz.
   ========================================================================= */
window.Home = (function () {
  const ALL = ["overview", "cube", "glacier", "map", "area", "probe"];
  const BACK = { cube: "home", glacier: "cube", map: "home", area: "map", probe: "area" };
  const ROTATOR = `Switzerland’s ice <span class="rotator" aria-live="polite"><span class="rot-word">is melting.</span></span>`;
  let page, lastMode = null;

  function rotator() {
    const words = ["is melting.", "is vanishing.", "turns to water.", "reshapes the Alps."];
    let i = 0;
    setInterval(() => {
      const el = document.querySelector(".rotator");
      if (!el || App.state.mode !== "overview") return;
      el.querySelector(".rot-word").classList.add("out");
      setTimeout(() => { i = (i + 1) % words.length; el.innerHTML = `<span class="rot-word">${words[i]}</span>`; }, 420);
    }, 2800);
  }

  // Titel, Erklärsatz und Pfad je Ansicht
  function head(s) {
    const g = s.glacier ? App.glacierById(s.glacier) : null;
    const core = s.mode === "probe" && g ? MapView.coresFor(g).find((c) => c.id === s.core) : null;
    const C = (label, route) => ({ label, route });
    const t = {
      overview: { title: null, lede: "", crumbs: [C("Overview")] },
      cube: { title: `All glaciers in ${s.year}`,
        lede: "Each layer is one year. Hover a layer to highlight it, click to pin it. The cylinders open single glaciers.",
        crumbs: [C("Overview", "home"), C("All glaciers")] },
      glacier: g && { title: g.name,
        lede: "The area taken apart year by year: each plate shows the terrain as lines and the ice as a blue area. The highlighted plate is the selected year.",
        crumbs: [C("Overview", "home"), C("All glaciers", "cube"), C(g.name)] },
      map: { title: "Glacier map",
        lede: "Pick a glacier to open its area. Drag to rotate the map, scroll to zoom.",
        crumbs: [C("Overview", "home"), C("Map")] },
      area: g && { title: g.name,
        lede: "Contour lines every 100 m. The cylinders are drill sites; blue marks real ice cores.",
        crumbs: [C("Overview", "home"), C("Map", "map"), C(g.name)] },
      probe: g && core && { title: core.real ? `Ice core ${core.name}` : `${core.name}, ${g.name}`,
        lede: core.real ? `${core.where}, ${core.elev}` : `Schematic drill site on ${g.name}, canton ${g.canton}.`,
        crumbs: [C("Overview", "home"), C("Map", "map"), C(g.name, "area/" + g.id), C(core.name)] }
    }[s.mode];
    if (!t) return;
    const title = App.$("view-title");
    if (t.title === null) { if (!title.querySelector(".rotator")) title.innerHTML = ROTATOR; }
    else title.textContent = t.title;
    App.$("view-lede").textContent = t.lede;
    App.$("crumbs").innerHTML = t.crumbs.map((c) => c.route ? `<li><a href="#${c.route}" data-route="${c.route}">${c.label}</a></li>` : `<li aria-current="page">${c.label}</li>`).join("");
    App.$("cube-tag").textContent = s.mode === "area" ? "Cube of this glacier" : "Cube";
  }

  function onRoute(s) {
    const mode = s.mode;
    ALL.forEach((m) => page.classList.toggle("state-" + m, m === mode));
    head(s);
    // im Cube-Modus läuft die Zeitleiste von selbst
    if (mode === "cube" && lastMode !== "cube") Timeline.play({ loop: true, fromStart: lastMode === "overview" });
    if (mode !== "cube" && lastMode === "cube") Timeline.stop();
    lastMode = mode;
  }

  function init() {
    page = App.$("page-home");
    rotator();
    App.$("back-btn").addEventListener("click", () => {
      const to = BACK[App.state.mode] || "home";
      App.go(["cube", "map", "home"].includes(to) ? to : `${to}/${App.state.glacier}`);
    });
    App.$("crumbs").addEventListener("click", (e) => {
      const a = e.target.closest("a[data-route]");
      if (a) { e.preventDefault(); App.go(a.dataset.route); }
    });
    App.onChange((s, what) => {
      if (what === "route") onRoute(s);
      else if (s.mode === "cube") head(s);
    });
  }

  return { init };
})();
