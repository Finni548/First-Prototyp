/* =========================================================================
   Gletscher-Ansicht als "Cutout" (Referenz: Kristall mit Daten-Fenster)
   - Hintergrund: echtes Foto des Gletschers (img/gletscher/<id>.jpg)
   - Raster-Fenster (Cutout): Höhenprofil durch den Gletscher, eine Linie pro
     Jahr 1970 → 2026. Fels unten, Eis darauf – man sieht, wie die Oberfläche
     Jahr für Jahr absinkt und die Zunge zurückweicht.
   - Bohrkern-Zylinder stecken im Eis des gewählten Jahres.
   - Gemeinte Ebene leuchtet: Jahr der Zeitleiste, Maus-Hover, Klick = Jahr wählen.
   ACHTUNG: Profil & Eisdicken sind modelliert (Prototyp), keine Messdaten.
   ========================================================================= */
window.GlacierView = (function () {
  const D = GLACIER_DATA;
  const NS = "http://www.w3.org/2000/svg";
  const KEY_YEARS = [1970, 1985, 2000, 2015, 2026];
  let root, svg, g = null, prof = null, hoverYear = null;

  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const ratio = (yr) => Math.max(0, D.area(g, yr) / D.area(g, D.FIRST));

  // Farbe pro Jahr: hellblau (1970) → blau → orange (heute) – wie die Spektral-Streifen der Referenz
  function yearColor(yr) {
    const t = (yr - D.FIRST) / (D.LAST - D.FIRST);
    const stops = [[0, [170, 209, 255]], [0.55, [77, 109, 255]], [0.8, [190, 90, 200]], [1, [255, 120, 60]]];
    let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1], u = (t - t0) / (t1 - t0);
    return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * u)).join(",")})`;
  }

  // ---------- Profil berechnen (modelliert) ----------
  function computeProfile() {
    const KX = Scene3D.KX, KY = Scene3D.KY;
    // Richtung talabwärts: tiefster Punkt auf einem Kreis von 5 km
    let best = 0, bestE = 1e9;
    for (let a = 0; a < 32; a++) {
      const ang = a / 32 * Math.PI * 2;
      const e = Scene3D.elevAt(g.lon + Math.cos(ang) * 5 / KX, g.lat + Math.sin(ang) * 5 / KY);
      if (e < bestE) { bestE = e; best = ang; }
    }
    const w = Math.max(1.2, Math.sqrt(g.a1973 / Math.PI) * 1.9);   // halbe Gletscherlänge in km
    const L = w * 1.9, N = 220;
    const xs = [], terr = [];
    for (let i = 0; i < N; i++) {
      const s = -L + 2 * L * i / (N - 1);                              // km, + = talabwärts
      xs.push(s);
      terr.push(Scene3D.elevAt(g.lon + Math.cos(best) * s / KX, g.lat + Math.sin(best) * s / KY));
    }
    const Tmax = 72 * Math.sqrt(g.a1973);                              // max. Eisdicke 1970 (Modell, m)
    const up = -w * 0.95;
    const tMin = Math.min(...terr), tMax = Math.max(...terr);
    function ice(i, yr) {
      const r = ratio(yr); if (r <= 0) return 0;
      const term = up + (w - up) * (0.25 + 0.75 * Math.pow(r, 3));    // Zunge zieht sich zurück
      const s = xs[i]; if (s < up || s > term) return 0;
      const c = (up + term) / 2, hw = (term - up) / 2;
      const shape = Math.sqrt(Math.max(0, 1 - Math.pow((s - c) / hw, 2)));
      const relAlt = (terr[i] - tMin) / Math.max(1, tMax - tMin);       // Zunge dünnt stärker aus
      return Tmax * shape * Math.pow(r, 1 + 2.2 * (1 - relAlt));
    }
    const ice70 = xs.map((_, i) => ice(i, D.FIRST));
    const bed = terr.map((t, i) => t - ice70[i]);
    return { xs, bed, ice, L, up, w, Tmax, N, termAt: (yr) => up + (w - up) * (0.25 + 0.75 * Math.pow(ratio(yr), 3)) };
  }

  // ---------- Zeichnen ----------
  function draw() {
    if (!g || root.hidden) return;
    const box = App.$("gv-cut").getBoundingClientRect();
    const W = box.width, H = box.height;
    if (!W) return;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = "";
    const defs = el("defs", {}, svg);
    const f = el("filter", { id: "gv-glow", x: "-20%", y: "-50%", width: "140%", height: "200%" }, defs);
    el("feGaussianBlur", { stdDeviation: 3, result: "b" }, f);
    const m = el("feMerge", {}, f); el("feMergeNode", { in: "b" }, m); el("feMergeNode", { in: "SourceGraphic" }, m);
    const hatch = el("pattern", { id: "gv-rock", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "rgba(255,255,255,.12)", "stroke-width": 1 }, hatch);

    // Raster
    const grid = el("g", { class: "gv-grid" }, svg);
    for (let x = 0; x <= W; x += W / 12) el("line", { x1: x, x2: x, y1: 0, y2: H }, grid);
    for (let y = 0; y <= H; y += H / 16) el("line", { x1: 0, x2: W, y1: y, y2: y }, grid);

    const { xs, bed, ice, N } = prof;
    const surf70 = bed.map((b, i) => b + ice(i, D.FIRST));
    const lo = Math.min(...bed) - 80, hi = Math.max(...surf70) + 120;
    const PX = (i) => 8 + (W - 60) * i / (N - 1);
    const PY = (e) => H - 18 - (H - 40) * (e - lo) / (hi - lo);

    // Höhenachse rechts
    const ax = el("g", { class: "gv-axis" }, svg);
    const step = (hi - lo) > 1600 ? 500 : 250;
    for (let e = Math.ceil(lo / step) * step; e < hi; e += step) {
      el("line", { x1: W - 48, x2: W - 40, y1: PY(e), y2: PY(e) }, ax);
      el("text", { x: W - 36, y: PY(e) + 3.5 }, ax).textContent = e + " m";
    }

    // Fels
    const bedPath = bed.map((b, i) => (i ? "L" : "M") + PX(i).toFixed(1) + "," + PY(b).toFixed(1)).join("");
    el("path", { class: "gv-bed", d: bedPath + `L${PX(N - 1)},${H}L${PX(0)},${H}Z` }, svg);
    el("path", { class: "gv-bedline", d: bedPath }, svg);

    // Eis des gewählten Jahres (Fläche)
    const yr = App.state.year;
    const surfOf = (y) => bed.map((b, i) => b + ice(i, y));
    const sNow = surfOf(yr);
    el("path", { class: "gv-icefill", d: sNow.map((s, i) => (i ? "L" : "M") + PX(i).toFixed(1) + "," + PY(s).toFixed(1)).join("") +
      bed.slice().reverse().map((b, k) => "L" + PX(N - 1 - k).toFixed(1) + "," + PY(b).toFixed(1)).join("") + "Z" }, svg);

    // Jahres-Ebenen: eine Linie pro Jahr (nur dort, wo Eis war)
    const layers = el("g", {}, svg);
    const lit = new Set([yr, hoverYear].filter(Boolean));
    D.years.forEach((y) => {
      const s = surfOf(y);
      let d = "", on = false;
      s.forEach((v, i) => {
        const has = v - bed[i] > 1;
        if (has) { d += (on ? "L" : "M") + PX(i).toFixed(1) + "," + PY(v).toFixed(1); on = true; } else on = false;
      });
      if (!d) return;
      const isLit = lit.has(y), key = KEY_YEARS.includes(y);
      const p = el("path", { d, class: "gv-layer" + (isLit ? " lit" : "") + (key ? " key" : ""), stroke: isLit ? "#fff" : yearColor(y) }, layers);
      if (isLit) p.setAttribute("filter", "url(#gv-glow)");
      const hit = el("path", { d, class: "gv-hit" }, layers);
      hit.addEventListener("mouseenter", (e) => { hoverYear = y; draw(); tip(y, e); });
      hit.addEventListener("mousemove", (e) => tip(y, e));
      hit.addEventListener("mouseleave", () => { hoverYear = null; draw(); App.hideTip(); });
      hit.addEventListener("click", () => { Timeline.stop(); App.setYear(y); });
    });
    // 1970 gestrichelt
    el("path", { class: "gv-1970", d: surf70.map((v, i) => (i ? "L" : "M") + PX(i).toFixed(1) + "," + PY(v).toFixed(1)).join("") }, svg);

    // Jahreszahlen an der Zunge der Schlüsseljahre
    const lab = el("g", { class: "gv-ylab" }, svg);
    let lastY = -1e9;
    KEY_YEARS.concat(KEY_YEARS.includes(yr) ? [] : [yr]).sort((a, b) => a - b).forEach((y) => {
      const s = surfOf(y);
      let iEnd = -1; s.forEach((v, i) => { if (v - bed[i] > 1) iEnd = i; });
      if (iEnd < 0) return;
      const x = PX(iEnd), yy = PY(s[iEnd]);
      const ly = Math.max(yy - 14, lastY + 13); lastY = ly;
      el("line", { x1: x, y1: yy, x2: x + 26, y2: ly, class: lit.has(y) ? "lit" : "" }, lab);
      el("text", { x: x + 29, y: ly + 3.5, class: lit.has(y) ? "lit" : "" }, lab).textContent = y;
    });

    // Bohrkerne im Eis des gewählten Jahres
    const cores = el("g", { class: "gv-cores" }, svg);
    [-0.55, -0.05, 0.42].forEach((fr, n) => {
      const sx = prof.up + (prof.termAt(yr) - prof.up) * (0.5 + fr * 0.9);
      const i = Math.round((sx + prof.L) / (2 * prof.L) * (N - 1));
      if (i < 0 || i >= N) return;
      const top = sNow[i], bot = bed[i], th = top - bot;
      if (th < 15) return;
      const x = PX(i), y0 = PY(top), y1 = PY(bot), rw = 5;
      const c = el("g", { class: "gv-core" }, cores);
      el("rect", { x: x - rw, y: y0, width: rw * 2, height: y1 - y0 }, c);
      el("ellipse", { cx: x, cy: y0, rx: rw, ry: 2.2 }, c);
      // Ringe: wo die Oberfläche in den Schlüsseljahren lag (innerhalb des heutigen Eises nicht sichtbar → markiere Dicke-Viertel)
      [0.25, 0.5, 0.75].forEach((q) => el("line", { x1: x - rw, x2: x + rw, y1: y0 + (y1 - y0) * q, y2: y0 + (y1 - y0) * q }, c));
      el("line", { class: "gv-core-lead", x1: x + rw, y1: y0, x2: x + 22, y2: y0 - 22 }, cores);
      el("text", { x: x + 24, y: y0 - 24 }, cores).textContent = `Bohrkern ${n + 1} · ${Math.round(th)} m`;
    });

    table();
  }

  function tip(y, e) {
    App.showTip(`<b>${y}</b> · ${App.fmt(D.area(g, y))} km²${D.hotSummers[y] ? ' · <span style="color:#e8743b">heisser Sommer</span>' : ""}<br><span style="color:#8a8d96">Klick: dieses Jahr wählen</span>`, e);
  }

  // ---------- Datentabelle links (wie in der Referenz) ----------
  function table() {
    const yr = App.state.year, a = D.area(g, yr), a0 = D.area(g, D.FIRST);
    const { bed, ice, N } = prof;
    let maxT = 0, maxDrop = 0;
    for (let i = 0; i < N; i++) { maxT = Math.max(maxT, ice(i, yr)); maxDrop = Math.max(maxDrop, ice(i, D.FIRST) - ice(i, yr)); }
    const retreat = Math.max(0, prof.termAt(D.FIRST) - prof.termAt(yr));
    const rows = [
      ["Gletscher", g.name],
      ["Kanton", g.canton],
      ["Jahr", yr],
      ["Fläche 1970", App.fmt(a0) + " km²"],
      ["Fläche " + yr, a > 0 ? App.fmt(a) + " km²" : "verschwunden"],
      ["Max. Eisdicke*", Math.round(maxT) + " m"],
      ["Oberfläche gesunken*", "bis " + Math.round(maxDrop) + " m"],
      ["Zunge zurück*", App.fmt(retreat, 1) + " km"],
      ["Bohrkerne", "3 Platzhalter"]
    ];
    App.$("gv-table").innerHTML = rows.map(([k, v], i) =>
      `<div class="gv-row${i === 2 ? " now" : ""}"><span>${k}</span><b>${v}</b></div>`).join("") +
      `<p class="gv-foot">* modelliert aus der Flächenänderung – Prototyp, keine Messwerte</p>`;
  }

  // ---------- Foto / Platzhalter ----------
  function photo() {
    const img = App.$("gv-photo"), fb = App.$("gv-fallback"), hint = App.$("gv-hint");
    const path = `img/gletscher/${g.id}.jpg`;
    hint.innerHTML = `Foto einfügen: <code>${path}</code>`;
    img.hidden = true; fb.hidden = false; hint.hidden = false;
    img.onload = () => { img.hidden = false; fb.hidden = true; hint.hidden = true; };
    img.onerror = () => { img.hidden = true; fb.hidden = false; hint.hidden = false; };
    img.src = path;
    // Platzhalter: Silhouette aus dem Gelände um den Gletscher
    fb.innerHTML = "";
    const W = 1000, H = 700;
    fb.setAttribute("viewBox", `0 0 ${W} ${H}`); fb.setAttribute("preserveAspectRatio", "xMidYMid slice");
    const d = el("defs", {}, fb);
    const lg = el("linearGradient", { id: "gv-sky", x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    el("stop", { offset: "0", "stop-color": "#0d1117" }, lg); el("stop", { offset: "1", "stop-color": "#4b5563" }, lg);
    const mg = el("linearGradient", { id: "gv-mt", x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    el("stop", { offset: "0", "stop-color": "#f4f7fb" }, mg); el("stop", { offset: ".35", "stop-color": "#b8c4d2" }, mg); el("stop", { offset: "1", "stop-color": "#3a4250" }, mg);
    el("rect", { width: W, height: H, fill: "url(#gv-sky)" }, fb);
    [0.35, 0.0].forEach((off, k) => {
      let p = `M0,${H}`;
      for (let i = 0; i <= 100; i++) {
        const lon = g.lon - 0.25 + 0.5 * i / 100, lat = g.lat + off * 0.2;
        const e = Scene3D.elevAt(lon, lat);
        p += `L${(i / 100 * W).toFixed(1)},${(H - 80 - (e - 800) / 3600 * H * (k ? 0.85 : 0.6)).toFixed(1)}`;
      }
      el("path", { d: p + `L${W},${H}Z`, fill: "url(#gv-mt)", opacity: k ? 1 : 0.45 }, fb);
    });
  }

  function show(glacier) {
    g = glacier; prof = computeProfile(); hoverYear = null;
    root.hidden = false;
    photo();
    requestAnimationFrame(draw);
  }
  function hide() { root.hidden = true; App.hideTip(); }

  function init() {
    root = App.$("gview"); svg = App.$("gv-svg");
    new ResizeObserver(() => draw()).observe(App.$("gv-cut"));
    App.onChange((s, what) => { if (what !== "route" && g && !root.hidden) draw(); });
  }

  return { init, show, hide };
})();
