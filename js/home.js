/* =========================================================================
   Startseite – Rahmen für alle Zustände
   Cube-Weg : overview → cube → glacier
   Karten-Weg: overview → map → area → probe
   Jede Ansicht hat denselben Kopf: Zurück + Pfad, Titel, ein erklärender Satz.
   ========================================================================= */
window.Home = (function () {
  const ALL = ["overview", "cube", "glacier", "map", "area", "probe"];
  const BACK = { cube: "home", glacier: "cube", map: "home", area: "map", probe: "area" };
  const ROTATOR = `Das Eis der Schweiz <span class="rotator" aria-live="polite"><span class="rot-word">schmilzt.</span></span>`;
  let page, lastMode = null;

  function rotator() {
    const words = ["schmilzt.", "verschwindet.", "wird zu Wasser.", "verändert die Alpen."];
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
      overview: { title: null, lede: "", crumbs: [C("Übersicht")] },
      cube: { title: `Alle Gletscher im Jahr ${s.year}`,
        lede: "Jede Ebene ist ein Jahr. Fahre über eine Ebene, um sie hervorzuheben, ein Klick hält sie fest. Die Zylinder öffnen einzelne Gletscher.",
        crumbs: [C("Übersicht", "home"), C("Alle Gletscher")] },
      glacier: g && { title: g.name,
        lede: "Derselbe Würfel, nur für diesen Gletscher: eine Eis-Ebene pro Jahr, modelliert aus seiner Fläche.",
        crumbs: [C("Übersicht", "home"), C("Alle Gletscher", "cube"), C(g.name)] },
      map: { title: "Karte der Gletscher",
        lede: "Wähle einen Gletscher, um sein Gebiet zu öffnen. Ziehen dreht die Karte, Scrollen zoomt.",
        crumbs: [C("Übersicht", "home"), C("Karte")] },
      area: g && { title: g.name,
        lede: "Höhenlinien alle 100 m. Die Zylinder sind Bohrstellen, orange markiert echte Bohrungen.",
        crumbs: [C("Übersicht", "home"), C("Karte", "map"), C(g.name)] },
      probe: g && core && { title: core.real ? `Kernbohrung ${core.name}` : `${core.name}, ${g.name}`,
        lede: core.real ? `${core.where}, ${core.elev}` : `Schematische Bohrstelle auf dem ${g.name}, Kanton ${g.canton}.`,
        crumbs: [C("Übersicht", "home"), C("Karte", "map"), C(g.name, "area/" + g.id), C(core.name)] }
    }[s.mode];
    if (!t) return;
    const title = App.$("view-title");
    if (t.title === null) { if (!title.querySelector(".rotator")) title.innerHTML = ROTATOR; }
    else title.textContent = t.title;
    App.$("view-lede").textContent = t.lede;
    App.$("crumbs").innerHTML = t.crumbs.map((c) => c.route ? `<li><a href="#${c.route}" data-route="${c.route}">${c.label}</a></li>` : `<li aria-current="page">${c.label}</li>`).join("");
    App.$("cube-tag").textContent = s.mode === "area" ? "Cube dieses Gletschers" : "Cube";
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
