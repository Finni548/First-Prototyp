/* =========================================================================
   Ansicht 2 – Karte der Schweiz mit den Gletschern
   Kreisfläche = Gletscherfläche im gewählten Jahr, gestrichelt = 1970.
   Klick auf einen Gletscher → Detailkarte in der Infospalte.
   ========================================================================= */
window.MapView = (function () {
  const D = GLACIER_DATA, M = window.SWISS_MAP;
  let svg, nodesLayer;
  const nodes = {};
  const R_SCALE = 5.7; // px pro √(km²/π)

  const project = (lon, lat) => [
    M.proj.ox + (lon - M.proj.minX) * M.proj.c * M.proj.k,
    M.proj.oy + (M.proj.maxY - lat) * M.proj.k
  ];
  const radius = (a) => (a <= 0 ? 0 : Math.max(2.5, Math.sqrt(a / Math.PI) * R_SCALE));

  // Beschriftungen nur für die grossen – Position von Hand gesetzt, damit nichts überlappt
  const LABELS = {
    aletsch:     { dx: -38, dy: -10, anchor: "end" },
    gorner:      { dx: 0,   dy: 50,  anchor: "middle" },
    fiescher:    { dx: 34,  dy: 26,  anchor: "start" },
    unteraar:    { dx: -6,  dy: -22, anchor: "end" },
    rhone:       { dx: 22,  dy: 6,   anchor: "start" },
    morteratsch: { dx: 0,   dy: 36,  anchor: "middle" },
    corbassiere: { dx: -26, dy: 4,   anchor: "end" },
    plainemorte: { dx: -18, dy: -12, anchor: "end" }
  };

  function build() {
    const { svgEl } = App;
    svg.innerHTML = "";
    svgEl("path", { class: "ch-land", d: M.country }, svg);
    svgEl("path", { class: "ch-cantons", d: M.cantons }, svg);
    svgEl("path", { class: "ch-lakes", d: M.lakes }, svg);

    nodesLayer = svgEl("g", {}, svg);
    // grosse zuerst zeichnen, kleine liegen oben und bleiben klickbar
    [...D.glaciers].sort((a, b) => b.a1973 - a.a1973).forEach((g) => {
      const [x, y] = project(g.lon, g.lat);
      const n = svgEl("g", { class: "g-node", transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`, tabindex: 0, role: "button", "aria-label": g.name }, nodesLayer);
      const ghost = svgEl("circle", { class: "g-ghost", r: radius(D.area(g, D.FIRST)) }, n);
      const dot = svgEl("circle", { class: "g-dot", r: radius(D.area(g, App.state.year)) }, n);
      const gone = svgEl("path", { class: "g-gone", d: "M-5,-5L5,5M5,-5L-5,5", visibility: "hidden" }, n);
      const hit = svgEl("circle", { class: "g-hit", r: Math.max(9, radius(g.a1973)) }, n);
      let label = null;
      if (LABELS[g.id]) {
        const L = LABELS[g.id];
        label = svgEl("text", { class: "g-label", x: L.dx, y: L.dy, "text-anchor": L.anchor }, n);
        label.textContent = g.name.replace("Grosser ", "").replace("Glacier de la ", "").replace("Glacier de ", "").replace("Vadret da ", "");
      }
      n.addEventListener("mousemove", (e) => {
        const a = D.area(g, App.state.year);
        App.showTip(
          `<div class="t-year">${g.canton} · ${App.state.year}</div><b>${g.name}</b><br>` +
          (a > 0 ? `${App.fmt(a)} km² · ${App.signed((a / D.area(g, D.FIRST) - 1) * 100, 0)} % seit 1970`
                 : `<span class="t-hot">verschwunden</span> – ${g.goneText}`), e);
      });
      n.addEventListener("mouseleave", App.hideTip);
      n.addEventListener("click", () => App.selectGlacier(App.state.selected === g.id ? null : g.id));
      n.addEventListener("keydown", (e) => { if (e.key === "Enter") App.selectGlacier(g.id); });
      nodes[g.id] = { g, n, dot, ghost, gone };
    });

    legend();
  }

  function legend() {
    const { svgEl } = App;
    const lg = svgEl("g", { class: "map-legend", transform: "translate(690,572)" }, svg);
    [[50, "50 km²"], [10, "10 km²"]].forEach(([a, t], i) => {
      const r = radius(a), cx = 30 + i * 80;
      svgEl("circle", { class: "g-dot", cx, cy: 40 - r, r }, lg);
      const tx = svgEl("text", { x: cx, y: 58, "text-anchor": "middle" }, lg); tx.textContent = t;
    });
    svgEl("circle", { class: "g-ghost", cx: 190, cy: 28, r: 10 }, lg);
    const t1 = svgEl("text", { x: 208, y: 32 }, lg); t1.textContent = "Grösse 1970";
    svgEl("path", { class: "g-gone", d: "M185,48l10,10M195,48l-10,10" }, lg);
    const t2 = svgEl("text", { x: 208, y: 57 }, lg); t2.textContent = "verschwunden";
  }

  function update() {
    const yr = App.state.year;
    Object.values(nodes).forEach(({ g, n, dot, gone }) => {
      const a = D.area(g, yr);
      dot.setAttribute("r", radius(a));
      const isGone = a <= 0;
      gone.setAttribute("visibility", isGone ? "visible" : "hidden");
      n.classList.toggle("is-selected", App.state.selected === g.id);
    });
    renderCard();
  }

  function renderCard() {
    const card = App.$("glacier-card");
    const id = App.state.selected;
    if (!id || App.state.view !== "map") { card.hidden = true; return; }
    const g = nodes[id].g, yr = App.state.year;
    const a = D.area(g, yr), a0 = D.area(g, D.FIRST);
    card.hidden = false;
    App.$("gc-canton").textContent = "Kanton " + g.canton;
    App.$("gc-name").textContent = g.name;
    App.$("gc-year").textContent = yr;
    App.$("gc-area").textContent = a > 0 ? App.fmt(a) + " km²" : "weg";
    App.$("gc-change").textContent = App.signed((a / a0 - 1) * 100, 0) + " %";
    App.$("gc-note").textContent = g.goneText
      ? g.goneText + "."
      : "Fläche gegenüber 1970 · Näherungswerte (Prototyp), später durch GLAMOS-Inventar ersetzen.";
    spark(g, yr);
  }

  function spark(g, yr) {
    const s = App.$("gc-spark"), { svgEl } = App;
    s.innerHTML = "";
    const W = 300, H = 90, P = { l: 4, r: 4, t: 8, b: 16 };
    const max = Math.max(...D.years.map((y) => D.area(g, y)));
    const X = (y) => P.l + (y - D.FIRST) / (D.LAST - D.FIRST) * (W - P.l - P.r);
    const Y = (a) => P.t + (1 - a / max) * (H - P.t - P.b);
    const line = D.years.map((y, i) => (i ? "L" : "M") + X(y).toFixed(1) + "," + Y(D.area(g, y)).toFixed(1)).join("");
    svgEl("path", { class: "s-area", d: line + `L${X(D.LAST)},${H - P.b}L${X(D.FIRST)},${H - P.b}Z` }, s);
    svgEl("path", { class: "s-line", d: line }, s);
    svgEl("line", { class: "s-now", x1: X(yr), x2: X(yr), y1: P.t - 4, y2: H - P.b }, s);
    svgEl("circle", { class: "s-dot", cx: X(yr), cy: Y(D.area(g, yr)), r: 4 }, s);
    [[D.FIRST, "start"], [D.LAST, "end"]].forEach(([y, an]) => {
      const t = svgEl("text", { x: X(y), y: H - 2, "text-anchor": an }, s); t.textContent = y;
    });
  }

  function init() {
    svg = App.$("map-svg");
    build();
    App.onChange(update);
    update();
  }

  return { init };
})();
