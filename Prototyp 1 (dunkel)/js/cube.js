/* =========================================================================
   Ansicht 1 – Der schmelzende Eisblock
   Glaswürfel = alles Schweizer Gletschereis von 1970 (100 %).
   Der Eisblock darin hat die Höhe des Volumens im gewählten Jahr.
   Darüber: die "abgeschnittenen Scheiben" – eine pro Jahr, Dicke = Eisverlust.
   ========================================================================= */
window.Cube = (function () {
  const D = GLACIER_DATA;
  let svg;

  // Geometrie (SVG-Koordinaten, viewBox 760 × 560)
  const FX = 90, FB = 510, FW = 340, FH = 380;   // Frontfläche: links, unten, Breite, Höhe (=100 %)
  const DX = 150, DY = -95;                      // Tiefe (schräg nach hinten rechts)
  const levelY = (v) => FB - FH * v / D.V0;

  // fester "Bruchkanten"-Verlauf für die Eisoberfläche
  const JAG = Array.from({ length: 19 }, (_, i) => (i === 0 || i === 18) ? 0 : Math.sin(i * 2.1) * 4 + Math.sin(i * 5.3) * 3);
  const jagPoints = (y, ox = 0, oy = 0) =>
    JAG.map((j, i) => [FX + ox + FW * i / (JAG.length - 1), y + oy + j]);
  const pts = (arr) => arr.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");

  function render() {
    const yr = App.state.year;
    const v = D.vol(yr);
    const yTop = levelY(v), y100 = levelY(D.V0);
    const { svgEl, fmt } = App;
    svg.innerHTML = "";

    // ---- Muster für den "verlorenen" Bereich ----
    const defs = svgEl("defs", {}, svg);
    const pat = svgEl("pattern", { id: "hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "rgba(124,200,245,.10)", "stroke-width": 2 }, pat);
    const grad = svgEl("linearGradient", { id: "iceGrad", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svgEl("stop", { offset: "0%", "stop-color": "rgba(124,200,245,.30)" }, grad);
    svgEl("stop", { offset: "100%", "stop-color": "rgba(42,127,184,.12)" }, grad);

    // ---- Boden & hintere Glaskanten ----
    svgEl("polygon", { class: "glass-floor", points: pts([[FX, FB], [FX + FW, FB], [FX + FW + DX, FB + DY], [FX + DX, FB + DY]]) }, svg);
    svgEl("path", { class: "glass-back", d: `M${FX + DX},${FB + DY} V${y100 + DY} M${FX + DX},${FB + DY} H${FX + FW + DX}` }, svg);

    // ---- Achse links (Prozent von 1970) ----
    const ax = svgEl("g", { class: "axis" }, svg);
    for (let p = 0; p <= 100; p += 10) {
      const y = FB - FH * p / 100;
      svgEl("line", { x1: FX - (p % 20 ? 5 : 9), x2: FX - 1, y1: y, y2: y }, ax);
      if (p % 20 === 0) { const t = svgEl("text", { x: FX - 14, y: y + 4, "text-anchor": "end" }, ax); t.textContent = p + "%"; }
    }

    // ---- verlorener Bereich (schraffiert) ----
    if (yTop > y100) {
      svgEl("rect", { class: "lost-fill", x: FX, y: y100, width: FW, height: yTop - y100 }, svg);
    }

    // ---- Eis: Seite, Front, Oberfläche ----
    const jFront = jagPoints(yTop);
    const jBack = jagPoints(yTop, DX, DY);
    const jEnd = JAG[JAG.length - 1];
    svgEl("polygon", { class: "ice-side", points: pts([[FX + FW, FB], [FX + FW + DX, FB + DY], [FX + FW + DX, yTop + DY + jEnd], [FX + FW, yTop + jEnd]]) }, svg);
    svgEl("polygon", { class: "ice-front", style: "fill:url(#iceGrad)", points: pts([[FX, FB], [FX + FW, FB], ...jFront.slice().reverse()]) }, svg);
    svgEl("polygon", { class: "ice-top", points: pts([...jFront, ...jBack.slice().reverse()]) }, svg);

    // innere Schichten im Eis (dekorativ – "different layers" aus der Skizze)
    for (let i = 1; i < 6; i++) {
      const y = FB - (FB - yTop) * i / 6;
      if (y < yTop + 10) continue;
      const d = jagPoints(y).map((p, k) => (k ? "L" : "M") + p[0].toFixed(1) + "," + (y + JAG[k] * 0.4).toFixed(1)).join(" ");
      svgEl("path", { d, fill: "none", stroke: "rgba(124,200,245,.12)" }, svg);
    }

    // ---- abgeschnittene Scheiben: eine pro Jahr bis zum gewählten Jahr ----
    const slices = svgEl("g", {}, svg);
    for (let y = D.FIRST + 1; y <= yr; y++) {
      const a = levelY(D.vol(y - 1)), b = levelY(D.vol(y));
      if (b <= a) continue; // Jahr mit Zuwachs
      const hot = !!D.hotSummers[y];
      const g = svgEl("g", { class: "slice" }, slices);
      const line = svgEl("line", { class: "stratum" + (hot ? " hot" : ""), x1: FX, x2: FX + FW, y1: a, y2: a }, g);
      svgEl("line", { class: "stratum" + (hot ? " hot" : ""), x1: FX + FW, x2: FX + FW + DX, y1: a, y2: a + DY, opacity: .6 }, g);
      if (hot) svgEl("rect", { x: FX, y: a, width: FW, height: b - a, fill: "rgba(255,138,61,.14)" }, g);
      const hit = svgEl("rect", { class: "stratum-hit", x: FX, y: (a + b) / 2 - Math.max(4, (b - a) / 2), width: FW + DX * .5, height: Math.max(8, b - a), fill: "transparent", stroke: "none" }, g);
      hit.addEventListener("mousemove", (e) => {
        line.classList.add("is-hover");
        App.showTip(
          `<div class="t-year">${y}${hot ? ' · <span class="t-hot">heisser Sommer</span>' : ""}</div>` +
          `<b>${App.signed(D.change(y))} km³</b> (${App.signed(D.changePct(y))} %)<br>danach noch ${fmt(D.vol(y))} km³`, e);
      });
      hit.addEventListener("mouseleave", () => { line.classList.remove("is-hover"); App.hideTip(); });
      hit.addEventListener("click", () => App.setYear(y));
    }

    // ---- Glaswürfel vorne (über dem Eis) ----
    svgEl("rect", { class: "glass", x: FX, y: y100, width: FW, height: FH }, svg);
    svgEl("path", { class: "glass", d: `M${FX},${y100} l${DX},${DY} h${FW} l${-DX},${-DY} M${FX + FW + DX},${y100 + DY} V${FB + DY} L${FX + FW},${FB}` }, svg);
    // Ebene 1970 gestrichelt
    svgEl("path", { class: "ghost", d: `M${FX},${y100} h${FW} l${DX},${DY}` }, svg);

    // ---- Beschriftungen rechts: 1970, heisse Sommer, aktuelles Jahr ----
    const labels = [{ y: y100, text: "1970 · " + fmt(D.V0) + " km³", cls: "" }];
    for (let y = D.FIRST + 1; y <= yr; y++) {
      if (D.hotSummers[y] && y !== yr) labels.push({ y: levelY(D.vol(y)), text: y + " · " + App.signed(D.changePct(y)) + " %", cls: "hot" });
    }
    labels.push({ y: yTop, text: yr + " · " + fmt(v) + " km³", cls: "now" });
    // Kollisionen vermeiden: von oben nach unten verteilen
    labels.sort((a, b) => a.y - b.y);
    let last = -Infinity;
    labels.forEach((l) => { l.ly = Math.max(l.y + DY * 0.0, last + 15); last = l.ly; });
    const LX = FX + FW + DX + 18;
    labels.forEach((l) => {
      svgEl("path", { class: "leader" + (l.cls === "hot" ? " hot" : ""), d: `M${FX + FW},${l.y} L${FX + FW + DX},${l.y + DY} M${FX + FW + DX + 2},${l.y + DY} L${LX - 4},${l.ly + DY - 4}`, fill: "none" }, svg);
      const t = svgEl("text", { class: "level-label " + l.cls, x: LX, y: l.ly + DY }, svg);
      t.textContent = l.text;
    });

    // Linie für aktuellen Stand + Jahr links an der Achse
    svgEl("line", { x1: FX - 9, x2: FX, y1: yTop, y2: yTop, stroke: "#7cc8f5", "stroke-width": 2 }, svg);

    // Tropfen unter dem Würfel – je mehr verloren, desto mehr
    const lostShare = 1 - v / D.V0;
    const drops = Math.round(lostShare * 14);
    for (let i = 0; i < drops; i++) {
      const x = FX + 20 + (i * 53) % (FW - 40), y = FB + 14 + (i % 3) * 7;
      svgEl("path", { class: "drip", d: `M${x},${y} q3,5 0,7 q-3,-2 0,-7z` }, svg);
    }
  }

  function init() {
    svg = App.$("cube-svg");
    App.onChange((s) => { if (s.view === "cube") render(); });
    render();
  }

  return { init, render };
})();
