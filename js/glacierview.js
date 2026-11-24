/* =========================================================================
   Gletscher-Ansicht – Ebenen als Explosionszeichnung (Referenz "Digitised Land")
   Vier schwebende Ebenen desselben Gebiets, von unten nach oben:
     1970  Höhenkarte in Graustufen mit Raster (Eis blau)
     1985  weisses Relief (nur Form, Eis hellblau)
     2000  nur Höhenlinien, Eisrand als blaue Linie
     Jahr  Oberfläche mit Fels & Eis – folgt der Zeitleiste
   Links: Beschriftung mit feiner Leitlinie · rechts: Höhenkarten je Jahr
   Werte: Gletscherflächen sind Näherungen; Eis-Volumen modelliert.
   ========================================================================= */
window.GlacierView = (function () {
  const D = GLACIER_DATA;
  let stage = null, root, g = null, built = null, hover = null;
  const GAP = 1.55;
  const v3 = new THREE.Vector3();

  function boxFor(g) { return { lon0: g.lon - 0.14, lon1: g.lon + 0.14, lat0: g.lat - 0.095, lat1: g.lat + 0.095 }; }

  // Höhenkarte als Bild (Graustufen + Eis in Blau + Raster)
  function heightmapCanvas(r, year, size = 256, grid = true) {
    const cv = document.createElement("canvas"); cv.width = cv.height = size;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(size, size);
    const [lo, hi] = r.eRange();
    r.setYear(year);
    const ice = r.iceField();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = Math.min(r.nx - 1, Math.round(x / (size - 1) * (r.nx - 1)));
      const j = Math.min(r.ny - 1, Math.round(y / (size - 1) * (r.ny - 1)));
      const k = j * r.nx + i, t = (r.EL[k] - lo) / (hi - lo);
      let c = [20 + 225 * t, 20 + 225 * t, 22 + 225 * t];
      const f = Math.min(1, (ice.get(k) || 0) * 1.6);
      if (f > 0) c = c.map((v, n) => v * (1 - f * 0.75) + [125, 175, 230][n] * f * 0.75);
      const p = (y * size + x) * 4; img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (grid) {
      ctx.strokeStyle = "rgba(20,24,30,.55)"; ctx.lineWidth = 1;
      for (let n = 1; n < 8; n++) { const q = Math.round(n * size / 8) + 0.5; ctx.beginPath(); ctx.moveTo(q, 0); ctx.lineTo(q, size); ctx.moveTo(0, q); ctx.lineTo(size, q); ctx.stroke(); }
    }
    return cv;
  }

  function build(glacier) {
    if (built) { stage.scene.remove(built.group); built = null; }
    g = glacier;
    const box = boxFor(g);
    let minE = 1e9;
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++)
      minE = Math.min(minE, Scene3D.elevAt(box.lon0 + (box.lon1 - box.lon0) * i / 10, box.lat0 + (box.lat1 - box.lat0) * j / 10));
    const common = { ...box, nx: 110, width: 5.2, vscale: 1.5, floor: minE - 100, base: -0.04, glass: false, shadow: false,
                     border: false, iceExag: 1.4, outsideFade: false, glacierMargin: 0, iceAlt: [1900, 2800], iceAltFloor: 0 };
    const group = new THREE.Group();

    // 1970 – Höhenkarte als flache Ebene
    const ref = Scene3D.buildRelief({ ...common });             // nur als Datenquelle
    const flatTex = new THREE.CanvasTexture(heightmapCanvas(ref, 1970, 512));
    flatTex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(ref.W, ref.DEP), new THREE.MeshBasicMaterial({ map: flatTex }));
    plane.rotation.x = -Math.PI / 2;
    const L0 = new THREE.Group(); L0.add(plane);

    // 1985 – weisses Relief
    const white = Scene3D.buildRelief({ ...common, mono: "#f3f4f5" });
    white.setYear(1985);
    // 2000 – nur Höhenlinien + Eisrand
    const lines = Scene3D.buildRelief({ ...common, contoursOnly: true, contours: 100, iceOutline: true });
    lines.setYear(2000);
    // gewähltes Jahr – Oberfläche
    const top = Scene3D.buildRelief({ ...common });
    top.setYear(App.state.year);

    const layers = [
      { key: "l0", obj: L0, y: 0, year: 1970, title: "Höhenkarte", sub: "Graustufen, Eis blau" },
      { key: "l1", obj: white.group, y: GAP, year: 1985, title: "Relief", sub: "nur die Form" },
      { key: "l2", obj: lines.group, y: GAP * 2, year: 2000, title: "Höhenlinien", sub: "alle 100 m, Eisrand blau" },
      { key: "l3", obj: top.group, y: GAP * 3, year: null, title: "Oberfläche", sub: "Fels und Eis" }
    ];
    layers.forEach((L) => { L.obj.position.y = L.y; group.add(L.obj); });

    // feine senkrechte Rahmenlinien an den Ecken
    const hw = ref.W / 2, hd = ref.DEP / 2;
    const frame = [];
    [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].forEach(([x, z]) => frame.push(x, 0, z, x, GAP * 3, z));
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(frame, 3));
    group.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: Scene3D.C.ink, transparent: true, opacity: 0.35 })));
    // dünner Rahmen um jede Ebene
    layers.forEach((L) => { if (L.key !== "l2") group.add(Object.assign(Scene3D.ringLine(hw, hd, L.y + 0.002, Scene3D.C.ink, 0.35), {})); });

    stage.scene.add(group);
    built = { group, layers, top, ref, hw, hd };
    labelsHtml();
    thumbs();
  }

  // ---------- Beschriftungen links + Leitlinien ----------
  function yearOf(L) { return L.year ?? App.state.year; }
  function labelsHtml() {
    const wrap = App.$("ex-labels");
    wrap.innerHTML = built.layers.map((L) => `<div class="ex-label" data-key="${L.key}"><b>${yearOf(L)} ${L.title}</b>${L.sub}</div>`).join("");
    wrap.querySelectorAll(".ex-label").forEach((el) => {
      el.addEventListener("mouseenter", () => { hover = el.dataset.key; mark(); });
      el.addEventListener("mouseleave", () => { hover = null; mark(); });
      el.addEventListener("click", () => { const L = built.layers.find((x) => x.key === el.dataset.key); if (L.year) { Timeline.stop(); App.setYear(L.year); } });
    });
    mark();
  }
  function activeKey() {
    const y = App.state.year;
    // aktiv: die Ebene, deren Jahr dem gewählten entspricht – sonst die Oberfläche (folgt immer dem Jahr)
    const L = built.layers.find((x) => x.year === y);
    return L ? L.key : "l3";
  }
  function mark() {
    const a = activeKey();
    document.querySelectorAll("#ex-labels .ex-label").forEach((el) => el.classList.toggle("on", el.dataset.key === a || el.dataset.key === hover));
    document.querySelectorAll("#ex-side .ex-thumb").forEach((el) => el.classList.toggle("on", el.dataset.key === a || el.dataset.key === hover));
  }

  function place() {
    if (!built || root.hidden) return;
    const w = stage.container.clientWidth, h = stage.container.clientHeight;
    const svg = App.$("ex-lines");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    let d = "";
    const left = w * 0.06;
    const a = activeKey();
    const paths = [];
    built.layers.forEach((L) => {
      // linkeste Ecke der Ebene auf dem Bildschirm
      let best = null;
      [[-built.hw, -built.hd], [built.hw, -built.hd], [built.hw, built.hd], [-built.hw, built.hd]].forEach(([x, z]) => {
        v3.set(x, L.y, z); built.group.localToWorld(v3); v3.project(stage.camera);
        const sx = (v3.x * 0.5 + 0.5) * w, sy = (-v3.y * 0.5 + 0.5) * h;
        if (!best || sx < best.x) best = { x: sx, y: sy };
      });
      const el = document.querySelector(`#ex-labels .ex-label[data-key="${L.key}"]`);
      if (!el) return;
      const ly = best.y - 30;
      el.style.transform = `translate(${left.toFixed(1)}px, ${(ly - 6).toFixed(1)}px)`;
      const x0 = left + 170 / 2 - 40, xl = left + 170 / 2 + 40;
      paths.push(`<path class="${L.key === a || L.key === hover ? "on" : ""}" d="M${x0},${ly + 30} H${best.x - 4} V${best.y} M${x0},${ly + 26} V${ly + 34}"/>`);
    });
    svg.innerHTML = paths.join("");
  }

  // ---------- Höhenkarten rechts ----------
  function thumbs() {
    const side = App.$("ex-side");
    const yr = App.state.year;
    const list = [[1970, "l0"], [1985, "l1"], [2000, "l2"], [yr, "l3"]];
    side.innerHTML = "";
    list.forEach(([y, key]) => {
      const f = document.createElement("figure"); f.className = "ex-thumb"; f.dataset.key = key;
      f.appendChild(heightmapCanvas(built.ref, y, 128, false));
      const c = document.createElement("figcaption"); c.textContent = `${y}, ${App.fmt(D.area(g, y))} km²`; f.appendChild(c);
      side.appendChild(f);
    });
    const a = D.area(g, yr), a0 = D.area(g, D.FIRST);
    const p = document.createElement("p"); p.className = "ex-note";
    p.textContent = a > 0 ? `${App.signed(a - a0)} km² seit 1970. Flächen sind Näherungen.` : `${g.goneText}.`;
    side.appendChild(p);
    mark();
  }

  function show(glacier, st) {
    stage = st; root.hidden = false;
    if (!built || g.id !== glacier.id) build(glacier);
    built.group.visible = true;
  }
  function hide() { root.hidden = true; if (built) built.group.visible = false; }
  function onYear() {
    if (!built || root.hidden) return;
    built.top.setYear(App.state.year);
    labelsHtml(); thumbs();
  }

  function init() {
    root = App.$("gview");
    App.onChange((s, what) => { if (what !== "route") onYear(); });
  }
  return { init, show, hide, place, isOn: () => !!built && !root.hidden };
})();
