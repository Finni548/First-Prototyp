/* =========================================================================
   Kernbohrung (Skizze 2A "Probe Way")
   - oben links klein: die Karte (Gebiet) – kommt aus mapview.js
   - links: Foto vom Gletscher-Gebiet mit Markierung der Bohrstelle
   - Mitte: der Eiskern als Zylinder; Ringe = Jahres-Schichten,
            das Jahr der Zeitleiste ist blau schraffiert (leuchtet)
   - rechts: echtes Foto eines Eiskerns + Tabelle "Real Data" (ein/aus)
   ========================================================================= */
window.Probe = (function () {
  const D = GLACIER_DATA;
  const NS = "http://www.w3.org/2000/svg";
  let root, svg, g = null, core = null;
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };

  // Länge & Schichten des Kerns
  function model() {
    if (core.real) {
      return {
        length: core.length,
        depthOf: core.depthYear,                 // null → schematisch
        topYear: core.id === "fh" ? 2002 : 2021,
        note: core.schematicLayers ? "Kernlänge und Bohrjahr sind echt. Die Lage der Jahresschichten ist schematisch, Tiefendaten fehlen noch." : "Tiefe der Jahre als lineare Näherung: die obersten 108 m entsprechen etwa 1943–2002."
      };
    }
    // schematischer Kern: Länge = modellierte Eisdicke an dieser Stelle im gewählten Jahr
    const frac = Math.pow(Math.max(0, D.area(g, App.state.year) / D.area(g, D.FIRST)), 1.36);
    const off = core.id === "k1" ? 1 : 0.62;
    const L = Math.max(8, Math.round(72 * Math.sqrt(g.a1973) * off * frac));
    const top = App.state.year;
    return { length: L, depthOf: (y) => (y > top ? null : (top - y) / Math.max(1, top - D.FIRST) * L * 0.9), topYear: top,
             note: "Schematischer Kern: Länge aus der modellierten Eisdicke, Schichten gleichmässig verteilt." };
  }

  function drawCore() {
    if (!core) return;
    const box = App.$("pr-core").getBoundingClientRect();
    const W = box.width, H = box.height; if (!W) return;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = "";
    const defs = el("defs", {}, svg);
    const hatch = el("pattern", { id: "pr-hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "#2e48cf", "stroke-width": 1.6 }, hatch);
    const rock = el("pattern", { id: "pr-rock", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(-45)" }, defs);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: "rgba(29,35,48,.3)", "stroke-width": 1 }, rock);
    const glow = el("filter", { id: "pr-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
    el("feGaussianBlur", { stdDeviation: 4, result: "b" }, glow);
    const fm = el("feMerge", {}, glow); el("feMergeNode", { in: "b" }, fm); el("feMergeNode", { in: "SourceGraphic" }, fm);
    const body = el("linearGradient", { id: "pr-body", x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    [["0", "#cfe5f8"], [".35", "#f6fafe"], [".7", "#d6e8f8"], ["1", "#b5d4ef"]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, body));

    const m = model();
    const cx = W * 0.5, rw = Math.min(70, W * 0.22), ry = rw * 0.28;
    const y0 = 40, y1 = H - 60;
    const Y = (d) => y0 + (y1 - y0) * d / m.length;

    // Tiefen-Achse
    const ax = el("g", { class: "pr-axis" }, svg);
    const step = m.length > 100 ? 25 : m.length > 40 ? 10 : 5;
    for (let d = 0; d <= m.length; d += step) {
      el("line", { x1: cx - rw - 26, x2: cx - rw - 18, y1: Y(d), y2: Y(d) }, ax);
      el("text", { x: cx - rw - 30, y: Y(d) + 3.5, "text-anchor": "end" }, ax).textContent = d + " m";
    }
    el("line", { x1: cx - rw - 18, x2: cx - rw - 18, y1: y0, y2: y1 }, ax);

    // Fels unter dem Kern
    if (core.real ? core.toBedrock : true) el("rect", { x: cx - rw - 10, y: y1 + ry, width: rw * 2 + 20, height: 30, fill: "url(#pr-rock)" }, svg);

    // Körper
    el("path", { class: "pr-body", d: `M${cx - rw},${y0} L${cx - rw},${y1} A${rw},${ry} 0 0 0 ${cx + rw},${y1} L${cx + rw},${y0}`, fill: "url(#pr-body)" }, svg);
    el("ellipse", { class: "pr-bottom", cx, cy: y1, rx: rw, ry }, svg);

    // Jahres-Ringe
    const yr = App.state.year;
    const ringYears = [...new Set([1970, 1985, 2000, 2015, yr].filter((y) => y <= m.topYear))].sort((a, b) => b - a);
    const schematic = !core.real || !!core.schematicLayers;
    let lastLy = -1e9;
    ringYears.forEach((y) => {
      const d = m.depthOf ? m.depthOf(y) : null;
      if (d == null || d < 0 || d > m.length) return;
      const cy = Y(d), on = y === yr;
      el("ellipse", { class: "pr-ring" + (on ? " on" : "") + (schematic ? " schem" : ""), cx, cy, rx: rw, ry, fill: on ? "url(#pr-hatch)" : "none", filter: on ? "url(#pr-glow)" : null }, svg);
      const ly = Math.max(cy, lastLy + 18); lastLy = ly;
      el("line", { class: "pr-lead" + (on ? " on" : ""), x1: cx + rw, y1: cy, x2: cx + rw + 30, y2: ly }, svg);
      el("text", { class: "pr-yl" + (on ? " on" : ""), x: cx + rw + 34, y: ly + 4 }, svg).textContent = `${y}, ${Math.round(d)} m`;
    });
    // Oberfläche
    el("ellipse", { class: "pr-top", cx, cy: y0, rx: rw, ry }, svg);
    el("text", { class: "pr-yl dim", x: cx + rw + 34, y: y0 - 12 }, svg).textContent = core.real ? `Oberfläche, gebohrt ${m.topYear}` : `Oberfläche ${m.topYear}`;
    el("text", { class: "pr-yl dim", x: cx + rw + 34, y: y1 + 4 }, svg).textContent = core.real ? (core.toBedrock ? `Fels, ${core.length} m` : `Kernende, ${core.length} m`) : `Fels, ca. ${m.length} m`;
    App.$("pr-after").textContent = yr > m.topYear ? `${yr} liegt nach der Bohrung von ${m.topYear} und ist nicht im Kern.` : "";
    App.$("pr-note").textContent = m.note;
  }

  function table() {
    const t = App.$("pr-table");
    const rows = (list) => `<dl class="rows">${list.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
    if (core.real) {
      t.innerHTML = rows([
        ["Ort", core.where], ["Höhe", core.elev], ["Bohrung", core.drilled],
        ["Kernlänge", core.length + " m" + (core.toBedrock ? ", bis zum Fels" : "")],
        ["Zeitraum im Eis", core.span], ["Institute", core.institutes.replace(/ · /g, ", ")],
        ...core.facts
      ]) + `<p class="pr-src">Quellen: ${core.sources.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join(", ")}</p>`;
    } else {
      t.innerHTML = rows([
        ["Bohrstelle", core.name], ["Gletscher", g.name],
        ["Fläche " + App.state.year, App.fmt(D.area(g, App.state.year)) + " km² (Näherung)"],
        ["Status", "Platzhalter, keine Messung"]
      ]) + `<p class="footnote">Für diesen Punkt gibt es noch keine echten Bohrdaten. Echte Schweizer Eiskerne:</p>
        <div class="pr-jumps">${D.realCores.map((c) => `<button class="pr-jump" data-core="${c.id}">${c.name}, ${c.drilled}</button>`).join("")}</div>`;
      t.querySelectorAll(".pr-jump").forEach((b) => b.addEventListener("click", () => {
        const c = D.realCores.find((x) => x.id === b.dataset.core);
        const host = D.glaciers.find((x) => MapView.coresFor(x).some((k) => k.id === c.id));
        if (host) App.openProbe(host.id, c.id);
      }));
    }
  }

  function photo() {
    // Foto des Gebiets (Berg-Cutout) mit Markierung der Bohrstelle
    App.$("pr-photo").src = window.BERG_CUTOUT || "img/berg-cutout.png";
    App.$("pr-site").textContent = core.real ? core.name : `${core.name}, ${g.name}`;
    // Eiskern-Foto: zuerst lokal (img/eiskern.jpg), sonst Wikimedia Commons (gemeinfrei)
    const ic = App.$("pr-icecore");
    const remote = "https://commons.wikimedia.org/wiki/Special:FilePath/GISP2D1837_crop.jpg?width=700";
    ic.onerror = () => { if (ic.dataset.step === "local") { ic.dataset.step = "remote"; ic.src = remote; } else { ic.hidden = true; App.$("pr-icecore-ph").hidden = false; } };
    ic.onload = () => { ic.hidden = false; App.$("pr-icecore-ph").hidden = true; };
    if (!ic.dataset.step) { ic.dataset.step = "local"; ic.src = "img/eiskern.jpg"; }
  }

  function show(glacier, coreId) {
    g = glacier;
    core = MapView.coresFor(g).find((c) => c.id === coreId) || MapView.coresFor(g)[0];
    root.hidden = false;
    App.$("pr-badge").textContent = core.real ? "Echte Bohrung" : "Platzhalter";
    App.$("pr-badge").classList.toggle("real", !!core.real);
    photo(); table();
    requestAnimationFrame(drawCore);
  }
  function hide() { root.hidden = true; }

  function init() {
    root = App.$("probe"); svg = App.$("pr-svg");
    App.$("pr-toggle").addEventListener("click", () => {
      const open = App.$("pr-table-wrap").classList.toggle("open");
      App.$("pr-toggle").setAttribute("aria-pressed", open);
      App.$("pr-toggle").lastChild.textContent = open ? "Messdaten ausblenden" : "Messdaten anzeigen";
    });
    new ResizeObserver(() => drawCore()).observe(App.$("pr-core"));
    App.onChange((s, what) => {
      if (what === "route") { if (s.mode === "probe") show(App.glacierById(s.glacier), s.core); else hide(); }
      else if (!root.hidden) { drawCore(); if (!core.real) table(); }
    });
  }
  return { init };
})();
