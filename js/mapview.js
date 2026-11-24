/* =========================================================================
   Karte: Relief der Schweiz im Glaskasten, interaktiv drehbar.
   Eisflächen werden je nach Jahr kleiner. Feine Beschriftungen mit Leitlinien.
   ========================================================================= */
window.MapView = (function () {
  const D = GLACIER_DATA;
  let stage, dio, layer;
  const labels = [];
  const v3 = new THREE.Vector3();

  // Länge der Leitlinie (px) – gestaffelt, damit sich Namen im Wallis nicht überdecken
  const LEAD = {
    aletsch: 120, gorner: 40, fiescher: 70, unteraar: 150, oberaletsch: 34, findel: 92, corbassiere: 56,
    rhone: 104, gauli: 186, trift: 132, otemma: 110, morteratsch: 70, zinal: 150, allalin: 196,
    plainemorte: 84, trient: 70, stein: 214, clariden: 60, tsanfleuron: 128, silvretta: 52,
    basodino: 64, birch: 236, pizol: 40
  };

  function buildLabels() {
    layer = App.$("map-labels");
    dio.glaciers.forEach((o) => {
      const g = o.g;
      const el = document.createElement("div");
      el.className = "glabel" + (g.a1973 < 8 ? " small" : "");
      el.innerHTML = `<div class="gl-text"><span class="gl-name">${g.name}</span><span class="gl-val"></span></div>
                      <div class="gl-line"></div><div class="gl-dot"></div>`;
      el.addEventListener("click", (e) => { e.stopPropagation(); App.selectGlacier(App.state.selected === g.id ? null : g.id); });
      layer.appendChild(el);
      labels.push({ o, el, val: el.querySelector(".gl-val"), line: el.querySelector(".gl-line"), text: el.querySelector(".gl-text") });
    });
  }

  // Beschriftungen jedes Frame neu verteilen: grosse Gletscher zuerst,
  // jede Beschriftung bekommt die kürzeste Leitlinie, bei der sie nichts überdeckt.
  const STEPS = Array.from({ length: 20 }, (_, i) => 24 + i * 16);
  function placeLabels() {
    const w = stage.container.clientWidth, h = stage.container.clientHeight;
    // Bereiche, die frei bleiben sollen: Titel, Zahlen-Karte, Gletscher-Karte
    const sr = stage.container.getBoundingClientRect();
    const placed = [".detail-head h2", ".detail-head p", "#info-card", "#glacier-card:not([hidden])"]
      .map((q) => document.querySelector("#page-map " + q) || document.querySelector(q))
      .filter((e) => e && !e.hidden && e.offsetParent !== null)
      .map((e) => { const r = e.getBoundingClientRect(); return { x0: r.left - sr.left - 6, x1: r.right - sr.left + 6, y0: r.top - sr.top - 6, y1: r.bottom - sr.top + 6, lx: -1, ly0: 0, ly1: 0 }; });
    const order = labels.slice().sort((a, b) => b.o.g.a1973 - a.o.g.a1973);
    order.forEach((L) => {
      const { o, el, line } = L;
      v3.set(o.x, o.y + 0.02, o.z).project(stage.camera);
      const x = (v3.x * 0.5 + 0.5) * w, y = (-v3.y * 0.5 + 0.5) * h;
      if (!L.bw) { L.bw = L.text.offsetWidth + 4; L.bh = L.text.offsetHeight + 2; }
      let chosen = null;
      for (const len of STEPS) {
        for (const side of [1, -1]) {           // Text rechts oder links der Leitlinie
          const box = side > 0
            ? { x0: x - 2, x1: x + L.bw, y0: y - len - L.bh, y1: y - len }
            : { x0: x - L.bw, x1: x + 2, y0: y - len - L.bh, y1: y - len };
          const hit = placed.some((p) =>
            (box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0) ||          // Text ↔ Text
            (p.lx > box.x0 && p.lx < box.x1 && p.ly0 < box.y1 && p.ly1 > box.y0));        // Text ↔ fremde Linie
          if (!hit && box.x0 > 4 && box.y0 > 4) { chosen = { ...box, len, side }; break; }
        }
        if (chosen) break;
      }
      const show = !!chosen || App.state.selected === o.g.id;
      if (!chosen) chosen = { len: STEPS[2], side: 1, x0: x, x1: x, y0: y, y1: y };
      el.classList.toggle("left", chosen.side < 0);
      placed.push({ ...chosen, lx: x, ly0: y - chosen.len, ly1: y });
      line.style.height = chosen.len + "px";
      el.classList.toggle("collapsed", !show);
      el.style.zIndex = show ? 100 + Math.round(y) : 1;   // Beschriftungen weiter vorne liegen oben
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${chosen.side < 0 ? "-100%" : "0"}, calc(-100% + 2.5px))`;
    });
  }

  function updateLabels() {
    const yr = App.state.year;
    labels.forEach(({ o, el, val }) => {
      const a = D.area(o.g, yr);
      const gone = a <= 0;
      el.classList.toggle("gone", gone);
      el.classList.toggle("is-selected", App.state.selected === o.g.id);
      val.textContent = gone ? "verschwunden " + o.g.goneYear : App.fmt(a) + " km²";
    });
  }

  function renderCard() {
    const card = App.$("glacier-card"), id = App.state.selected;
    if (!id || App.state.page !== "map") { card.hidden = true; return; }
    const g = D.glaciers.find((x) => x.id === id), yr = App.state.year;
    const a = D.area(g, yr), a0 = D.area(g, D.FIRST);
    card.hidden = false;
    App.$("gc-canton").textContent = "Kanton " + g.canton;
    App.$("gc-name").textContent = g.name;
    App.$("gc-year").textContent = yr;
    App.$("gc-area").textContent = a > 0 ? App.fmt(a) + " km²" : "weg";
    App.$("gc-change").textContent = App.signed((a / a0 - 1) * 100, 0) + " %";
    App.$("gc-note").textContent = g.goneText ? g.goneText + "." : "Fläche gegenüber 1970 · Näherungswerte (Prototyp).";
    spark(g, yr);
  }

  function spark(g, yr) {
    const s = App.$("gc-spark"), NS = "http://www.w3.org/2000/svg";
    const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); s.appendChild(e); return e; };
    s.innerHTML = "";
    const W = 300, H = 80, P = { l: 2, r: 2, t: 6, b: 14 };
    const max = Math.max(...D.years.map((y) => D.area(g, y)));
    const X = (y) => P.l + (y - D.FIRST) / (D.LAST - D.FIRST) * (W - P.l - P.r);
    const Y = (a) => P.t + (1 - a / max) * (H - P.t - P.b);
    const line = D.years.map((y, i) => (i ? "L" : "M") + X(y).toFixed(1) + "," + Y(D.area(g, y)).toFixed(1)).join("");
    el("path", { class: "s-area", d: line + `L${X(D.LAST)},${H - P.b}L${X(D.FIRST)},${H - P.b}Z` });
    el("path", { class: "s-line", d: line });
    el("line", { class: "s-now", x1: X(yr), x2: X(yr), y1: P.t - 4, y2: H - P.b });
    el("circle", { class: "s-dot", cx: X(yr), cy: Y(D.area(g, yr)), r: 3.5 });
    el("text", { x: X(D.FIRST), y: H - 1, "text-anchor": "start" }).textContent = D.FIRST;
    el("text", { x: X(D.LAST), y: H - 1, "text-anchor": "end" }).textContent = D.LAST;
  }

  function init() {
    stage = Scene3D.createStage(App.$("map-stage"), { fov: 30, theta: 0, phi: 0.82, radius: 20, minR: 7, maxR: 30, target: [0, -0.1, 0.4], shift: 0.1, interactive: true });
    dio = Scene3D.buildDiorama({ glassH: 2.0, iceExag: 3 });
    stage.scene.add(dio.group);
    buildLabels();
    stage.onFrame = placeLabels;
    stage.active = false;

    App.$("glacier-close").addEventListener("click", () => App.selectGlacier(null));
    App.onChange((s) => { dio.setYear(s.year); updateLabels(); renderCard(); });
    dio.setYear(App.state.year); updateLabels();

    App.registerPage("map", {
      show() { stage.active = true; stage.resize(); },
      hide() { stage.active = false; }
    });
  }

  return { init };
})();
