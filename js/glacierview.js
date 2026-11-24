/* =========================================================================
   Gletscher-Ansicht – Bühne hinter dem Gletscher-Würfel (Cutout-Look)
   Das Fenster ist wie aus dem Foto HERAUSGESCHNITTEN:
   1. Berg-Foto (img/berg-cutout)
   2. Loch  : wo das Stück fehlt – vertiefte Fläche mit Schatten an den Schnittkanten
   3. Stück : das herausgelöste Bildstück, leicht nach vorne versetzt,
              mit sichtbarer Dicke, Schatten in Bergform, heller Schnittkante
              und – wie in der Referenz – Pixel-Streifen & Partikeln am Rand
   4. Rahmen + Raster darüber, davor der Würfel (cubeview.js)
   Werte: Fläche = Näherung, Eis-Anteil = (Fläche/1970)^1.36 → modelliert
   ========================================================================= */
window.GlacierView = (function () {
  const D = GLACIER_DATA;
  let root, g = null, img, holeCv, slabCv, frame, ready = false;
  const LIFT = { x: -42, y: -30 };   // so weit ist das Stück nach vorne/oben gezogen
  const DEPTH = 16;                  // Dicke des Stücks in px

  // ---------- Datentabelle ----------
  function table() {
    if (!g) return;
    const yr = App.state.year, a = D.area(g, yr), a0 = D.area(g, D.FIRST);
    const frac = Math.pow(Math.max(0, a / a0), 1.36);
    const rows = [
      ["Gletscher", g.name], ["Kanton", g.canton], ["Jahr", yr],
      ["Fläche 1970", App.fmt(a0) + " km²"],
      ["Fläche " + yr, a > 0 ? App.fmt(a) + " km²" : "verschwunden"],
      ["Verlust seit 1970", App.signed(a - a0) + " km²"],
      ["Eis-Volumen*", App.fmt(frac * 100, 0) + " % von 1970"],
      ["Ebenen", (yr - D.FIRST + 1) + " Jahre"],
      ["Bohrkerne", "3 Platzhalter"]
    ];
    App.$("gv-table").innerHTML =
      `<dl class="rows">${rows.map(([k, v], i) => `<div class="${i === 2 ? "now" : i === 6 ? "key" : ""}"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` +
      (g.goneText ? `<p class="footnote">${g.goneText}.</p>` : "") +
      `<div class="legend">
         <div><i></i>Eis-Ebene eines Jahres</div>
         <div><i class="l-hot"></i>Heisser Sommer</div>
         <div><i class="l-lit"></i>Gewählt oder festgehalten</div>
         <div><i class="l-core"></i>Bohrkern</div>
       </div>
       <p class="footnote">* Modelliert aus der Flächenänderung (Volumen ≈ Fläche<sup>1.36</sup>), keine Messwerte.</p>`;
  }

  // ---------- Cutout ----------
  // kleiner Zufallsgenerator mit festem Startwert → Streifen sehen immer gleich aus
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

  function buildCutout() {
    if (!ready || root.hidden) return;
    const R = root.getBoundingClientRect();
    const ir = img.getBoundingClientRect(), wr = frame.getBoundingClientRect();
    if (!ir.width || !wr.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(wr.width), H = Math.round(wr.height);
    const wx = wr.left - R.left, wy = wr.top - R.top;
    // Ausschnitt des Fotos, der unter dem Fenster liegt (in Bildpixeln)
    const sc = img.naturalWidth / ir.width;
    const src = { x: (wr.left - ir.left) * sc, y: (wr.top - ir.top) * sc, w: W * sc, h: H * sc };

    // Maske/Bild des Stücks in Fenstergrösse
    const piece = document.createElement("canvas");
    piece.width = W * dpr; piece.height = H * dpr;
    const pc = piece.getContext("2d");
    pc.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, piece.width, piece.height);

    // ===== 1) Loch: vertiefte Fläche dort, wo Berg war =====
    holeCv.width = W * dpr; holeCv.height = H * dpr;
    Object.assign(holeCv.style, { left: wx + "px", top: wy + "px", width: W + "px", height: H + "px" });
    const hc = holeCv.getContext("2d");
    hc.clearRect(0, 0, holeCv.width, holeCv.height);
    hc.drawImage(piece, 0, 0);
    hc.globalCompositeOperation = "source-in";
    const hg = hc.createLinearGradient(0, 0, holeCv.width * 0.6, holeCv.height);
    hg.addColorStop(0, "#a9a395"); hg.addColorStop(0.4, "#cbc5b8"); hg.addColorStop(1, "#e2ddd2");
    hc.fillStyle = hg; hc.fillRect(0, 0, holeCv.width, holeCv.height);
    // Schatten an den Schnittkanten (oben & links tiefer, da Licht von oben links)
    hc.globalCompositeOperation = "source-atop";
    const edge = (x0, y0, x1, y1, a) => { const gr = hc.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, `rgba(40,34,24,${a})`); gr.addColorStop(1, "rgba(40,34,24,0)"); return gr; };
    const E = 26 * dpr;
    hc.fillStyle = edge(0, 0, 0, E, 0.55); hc.fillRect(0, 0, holeCv.width, E);
    hc.fillStyle = edge(0, 0, E, 0, 0.45); hc.fillRect(0, 0, E, holeCv.height);
    hc.fillStyle = edge(0, holeCv.height, 0, holeCv.height - E * 0.5, 0.18); hc.fillRect(0, holeCv.height - E, holeCv.width, E);
    hc.fillStyle = edge(holeCv.width, 0, holeCv.width - E * 0.5, 0, 0.18); hc.fillRect(holeCv.width - E, 0, E, holeCv.height);
    // feine Felsstruktur im Loch (Abdruck des Bildes, sehr schwach)
    hc.globalAlpha = 0.12; hc.globalCompositeOperation = "multiply"; hc.drawImage(piece, 0, 0); hc.globalAlpha = 1;
    hc.globalCompositeOperation = "source-over";

    // ===== 2) Stück: versetzt, mit Dicke, Schatten, Kante, Streifen =====
    const M = 60; // Rand für Schatten/Streifen/Partikel
    slabCv.width = (W + M * 2) * dpr; slabCv.height = (H + M * 2) * dpr;
    Object.assign(slabCv.style, { left: (wx + LIFT.x - M) + "px", top: (wy + LIFT.y - M) + "px", width: (W + M * 2) + "px", height: (H + M * 2) + "px" });
    const sc2 = slabCv.getContext("2d");
    sc2.clearRect(0, 0, slabCv.width, slabCv.height);
    const O = M * dpr;

    // Silhouette (für Dicke & Schatten)
    const sil = document.createElement("canvas"); sil.width = piece.width; sil.height = piece.height;
    const sl = sil.getContext("2d"); sl.drawImage(piece, 0, 0); sl.globalCompositeOperation = "source-in";

    // Schatten auf das Loch (in Bergform, weich)
    sl.fillStyle = "rgba(30,26,20,1)"; sl.fillRect(0, 0, sil.width, sil.height);
    sc2.save(); sc2.globalAlpha = 0.38; sc2.filter = `blur(${12 * dpr}px)`;
    sc2.drawImage(sil, O - LIFT.x * dpr * 0.9, O - LIFT.y * dpr * 0.9); sc2.restore();

    // Dicke: die Seitenwand des Stücks (von hinten nach vorne gestapelt)
    for (let t = DEPTH; t >= 1; t--) {
      const k = t / DEPTH;
      sl.globalCompositeOperation = "source-in";
      sl.fillStyle = `rgb(${Math.round(150 + 60 * (1 - k))},${Math.round(145 + 60 * (1 - k))},${Math.round(136 + 60 * (1 - k))})`;
      sl.fillRect(0, 0, sil.width, sil.height);
      sc2.drawImage(sil, O + t * dpr * 0.75, O + t * dpr * 0.6);
    }

    // das Bildstück selbst – etwas klarer/heller als der Berg dahinter
    sc2.save(); sc2.filter = "contrast(1.08) brightness(1.04) saturate(1.05)";
    sc2.drawImage(piece, O, O); sc2.restore();

    // Glas-Glanz oben links
    sc2.save(); sc2.globalCompositeOperation = "source-atop";
    const gl = sc2.createLinearGradient(O, O, O + W * dpr * 0.7, O + H * dpr * 0.7);
    gl.addColorStop(0, "rgba(255,255,255,.28)"); gl.addColorStop(0.35, "rgba(255,255,255,0)");
    sc2.fillStyle = gl; sc2.fillRect(O, O, W * dpr, H * dpr); sc2.restore();

    // helle Schnittkante entlang des Rechtecks (nur wo Berg ist)
    sc2.save(); sc2.globalCompositeOperation = "source-atop";
    sc2.strokeStyle = "rgba(255,255,255,.95)"; sc2.lineWidth = 2 * dpr;
    sc2.strokeRect(O + dpr, O + dpr, W * dpr - 2 * dpr, H * dpr - 2 * dpr);
    sc2.restore();

    // ===== 3) Pixel-Streifen & Partikel (wie bei der Kristall-Referenz) =====
    const rnd = rng(1234 + g.id.length * 97);
    const data = pc.getImageData(0, 0, piece.width, piece.height).data;
    const px = (x, y) => { const i = (Math.round(y) * piece.width + Math.round(x)) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
    // Streifen: an der rechten Fensterkante werden Bildzeilen nach rechts "verschmiert"
    const xEdge = piece.width - 2;
    for (let y = 0; y < piece.height; y += Math.max(1, Math.round(dpr))) {
      const c = px(xEdge - 3 * dpr, y);
      if (c[3] < 80 || rnd() < 0.72) continue;
      const len = (12 + rnd() * 70) * dpr * (rnd() < 0.12 ? 2 : 1);
      const hue = rnd();
      const tint = hue < 0.12 ? [255, 90, 60] : hue < 0.24 ? [80, 130, 255] : null; // vereinzelt Spektralfarben
      const col = tint ? tint : [c[0], c[1], c[2]];
      const gr = sc2.createLinearGradient(O + xEdge, 0, O + xEdge + len, 0);
      gr.addColorStop(0, `rgba(${col.join(",")},${tint ? 0.75 : 0.85})`); gr.addColorStop(1, `rgba(${col.join(",")},0)`);
      sc2.fillStyle = gr; sc2.fillRect(O + xEdge, O + y, len, Math.max(1, dpr * (rnd() < 0.2 ? 2 : 1)));
    }
    // Partikel: von der oberen Kante des Stücks lösen sich Bildpunkte nach oben
    for (let n = 0; n < 900; n++) {
      const x = rnd() * piece.width, y0 = rnd() * piece.height * 0.5;
      const c = px(x, y0);
      if (c[3] < 120) continue;
      const rise = Math.pow(rnd(), 2.2) * (O + y0 * 0.6);
      const s = (0.8 + rnd() * 1.8) * dpr;
      sc2.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.25 + rnd() * 0.6})`;
      sc2.fillRect(O + x + (rnd() - 0.5) * 6 * dpr, O + y0 - rise, s, s);
    }
  }

  function show(glacier) {
    g = glacier; root.hidden = false; table();
    requestAnimationFrame(() => requestAnimationFrame(buildCutout));
  }
  function hide() { root.hidden = true; }

  function init() {
    root = App.$("gview"); holeCv = App.$("gv-hole"); slabCv = App.$("gv-slab"); frame = App.$("gv-window");
    img = App.$("gv-mountain");
    img.onload = () => { ready = true; buildCutout(); };
    img.src = window.BERG_CUTOUT || "img/berg-cutout.png";
    let t = 0;
    new ResizeObserver(() => { clearTimeout(t); t = setTimeout(buildCutout, 120); }).observe(root);
    App.onChange((s, what) => { if (what !== "route" && !root.hidden) table(); });
  }
  return { init, show, hide };
})();
