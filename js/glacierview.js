/* =========================================================================
   Gletscher-Ansicht – Jahres-Ebenen als schwebende Platten (Referenz 4)
   - jedes Jahr = eine dünne Platte, darauf das Gelände nur als feine Linien
     (Profillinien quer durchs Gebiet), Eis in Blau
   - die Eisoberfläche liegt um die (modellierte) Eisdicke über dem Fels:
     von Platte zu Platte sinkt sie sichtbar ab, die Eisfläche schrumpft
   - Eckwinkel an jeder Ebene, oben eine leere Deckplatte
   - links Beschriftung mit Leitlinie, rechts Höhenkarten je Jahr
   Werte: Flächen = Näherung, Eisdicke modelliert (Prototyp)
   ========================================================================= */
window.GlacierView = (function () {
  const D = GLACIER_DATA;
  const YEARS = [1970, 1985, 2000, 2015];          // + gewähltes Jahr oben
  const GAP = 1.6, ROWS = 52, ICE_T = 0.3;        // Abstand, Anzahl Linien, Eisdicke (Welt-Einheiten, überhöht)
  let stage = null, root, g = null, built = null, hover = null;
  const v3 = new THREE.Vector3();
  const INK = new THREE.Color("#2a2f37"), BLUE = new THREE.Color("#2e48cf"), ICE = new THREE.Color("#5f86e0");

  const boxFor = (g) => ({ lon0: g.lon - 0.14, lon1: g.lon + 0.14, lat0: g.lat - 0.095, lat1: g.lat + 0.095 });
  const yearsShown = () => { const y = App.state.year; return YEARS.includes(y) || y < YEARS[YEARS.length - 1] ? [...YEARS.filter((x) => x !== y), y].sort((a, b) => a - b) : [...YEARS, y]; };

  // ---------- eine Ebene: Profillinien des Geländes + Eis ----------
  function lineLayer(ref, year, active) {
    ref.setYear(year);
    const ice = ref.iceField();
    const pos = [], col = [];
    const step = Math.max(1, Math.round(ref.ny / ROWS));
    const yAt = (k) => ref.Y(k) + Math.min(1, (ice.get(k) || 0) * 1.5) * ICE_T;
    for (let j = 0; j < ref.ny; j += step) {
      for (let i = 0; i < ref.nx - 1; i++) {
        const a = j * ref.nx + i, b = a + 1;
        const fa = ice.get(a) || 0, fb = ice.get(b) || 0;
        const c = (fa + fb) / 2 > 0.15 ? ICE : INK;
        pos.push(ref.X(a), yAt(a), ref.Z(a), ref.X(b), yAt(b), ref.Z(b));
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: active ? 0.95 : 0.4 }));
    const grp = new THREE.Group();
    grp.add(lines);
    // dünne Platte darunter + Rahmen
    const hw = ref.W / 2, hd = ref.DEP / 2;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(ref.W, ref.DEP),
      new THREE.MeshBasicMaterial({ color: active ? 0xdfe6f7 : 0xffffff, transparent: true, opacity: active ? 0.55 : 0.28, depthWrite: false, side: THREE.DoubleSide }));
    plate.rotation.x = -Math.PI / 2; plate.position.y = -0.02;
    grp.add(plate);
    grp.add(Scene3D.ringLine(hw, hd, -0.02, active ? BLUE : INK, active ? 0.9 : 0.3));
    grp.add(brackets(hw, hd, -0.02, active));
    return { grp, lines };
  }

  // Eckwinkel wie in der Referenz: kurze L-Linien etwas ausserhalb der Ecken
  function brackets(hw, hd, y, active) {
    const o = 0.22, l = 0.55, p = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
      const x = sx * (hw + o), z = sz * (hd + o);
      p.push(x, y, z, x - sx * l, y, z, x, y, z, x, y, z - sz * l);
      p.push(x, y, z, x, y + 0.35, z);                      // kleine senkrechte Marke
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: active ? BLUE : INK, transparent: true, opacity: active ? 0.9 : 0.45 }));
  }

  // Höhenkarte als Bild (für die Spalte rechts)
  function heightmapCanvas(ref, year, size = 128) {
    const cv = document.createElement("canvas"); cv.width = cv.height = size;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(size, size);
    const [lo, hi] = ref.eRange();
    ref.setYear(year);
    const ice = ref.iceField();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = Math.min(ref.nx - 1, Math.round(x / (size - 1) * (ref.nx - 1)));
      const j = Math.min(ref.ny - 1, Math.round(y / (size - 1) * (ref.ny - 1)));
      const k = j * ref.nx + i, t = (ref.EL[k] - lo) / (hi - lo);
      let c = [40 + 205 * t, 42 + 205 * t, 46 + 205 * t];
      const f = Math.min(1, (ice.get(k) || 0) * 1.6);
      if (f > 0) c = c.map((v, n) => v * (1 - f * 0.7) + [95, 134, 224][n] * f * 0.7);
      const p = (y * size + x) * 4; img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function build(glacier) {
    if (built) { stage.scene.remove(built.group); }
    g = glacier;
    const box = boxFor(g);
    let minE = 1e9;
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++)
      minE = Math.min(minE, Scene3D.elevAt(box.lon0 + (box.lon1 - box.lon0) * i / 10, box.lat0 + (box.lat1 - box.lat0) * j / 10));
    const ref = Scene3D.buildRelief({ ...box, nx: 120, width: 5.4, vscale: 1.35, floor: minE - 60, base: -0.04, glass: false, shadow: false,
      border: false, iceExag: 1.4, outsideFade: false, glacierMargin: 0, iceAlt: [1900, 2800], iceAltFloor: 0 });
    built = { group: new THREE.Group(), ref, hw: ref.W / 2, hd: ref.DEP / 2, layers: [] };
    stage.scene.add(built.group);
    layout();
  }

  // Ebenen (neu) aufbauen – bei Jahreswechsel
  function layout() {
    const { ref } = built;
    built.group.clear();
    const yr = App.state.year;
    const ys = yearsShown();
    built.layers = ys.map((y, n) => {
      const active = y === yr;
      const L = lineLayer(ref, y, active);
      L.grp.position.y = n * GAP;
      built.group.add(L.grp);
      return { key: "y" + y, year: y, y: n * GAP, active };
    });
    // leere Deckplatte oben (wie in der Referenz)
    const topY = ys.length * GAP;
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(ref.W, ref.DEP), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    lid.rotation.x = -Math.PI / 2; lid.position.y = topY;
    built.group.add(lid, Scene3D.ringLine(built.hw, built.hd, topY, INK, 0.35), brackets(built.hw, built.hd, topY, false));
    // feine senkrechte Linien an den Ecken
    const p = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => p.push(sx * built.hw, -0.02, sz * built.hd, sx * built.hw, topY, sz * built.hd));
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    built.group.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.18 })));
    built.group.position.y = -topY / 2 + 1.5;
    labelsHtml(); thumbs();
  }

  // ---------- Beschriftung links ----------
  function labelsHtml() {
    const wrap = App.$("ex-labels");
    const yr = App.state.year;
    wrap.innerHTML = built.layers.map((L) => {
      const a = D.area(g, L.year);
      return `<div class="ex-label${L.active ? " on" : ""}" data-key="${L.key}"><b>${L.year}${L.year === D.LAST ? " (today)" : ""}</b>${a > 0 ? App.fmt(a) + " km² of ice" : "gone"}</div>`;
    }).join("");
    wrap.querySelectorAll(".ex-label").forEach((el) => {
      el.addEventListener("mouseenter", () => { hover = el.dataset.key; mark(); });
      el.addEventListener("mouseleave", () => { hover = null; mark(); });
      el.addEventListener("click", () => { Timeline.stop(); App.setYear(+el.dataset.key.slice(1)); });
    });
    mark();
  }
  function mark() {
    const a = "y" + App.state.year;
    document.querySelectorAll("#ex-labels .ex-label").forEach((el) => el.classList.toggle("on", el.dataset.key === a || el.dataset.key === hover));
    document.querySelectorAll("#ex-side .ex-thumb").forEach((el) => el.classList.toggle("on", el.dataset.key === a || el.dataset.key === hover));
  }

  function place() {
    if (!built || root.hidden) return;
    const w = stage.container.clientWidth, h = stage.container.clientHeight;
    const svg = App.$("ex-lines");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const left = w * 0.05, a = "y" + App.state.year, paths = [];
    built.layers.forEach((L) => {
      let best = null;
      [[-built.hw, -built.hd], [built.hw, -built.hd], [built.hw, built.hd], [-built.hw, built.hd]].forEach(([x, z]) => {
        v3.set(x, L.y - 0.02, z); built.group.localToWorld(v3); v3.project(stage.camera);
        const sx = (v3.x * 0.5 + 0.5) * w, sy = (-v3.y * 0.5 + 0.5) * h;
        if (!best || sx < best.x) best = { x: sx, y: sy };
      });
      const el = document.querySelector(`#ex-labels .ex-label[data-key="${L.key}"]`);
      if (!el) return;
      el.style.transform = `translate(${left.toFixed(1)}px, ${(best.y - 34).toFixed(1)}px)`;
      const x0 = left + 85 - 40;
      paths.push(`<path class="${L.key === a || L.key === hover ? "on" : ""}" d="M${x0},${best.y} H${best.x - 6} M${x0},${best.y - 4} V${best.y + 4}"/>`);
    });
    svg.innerHTML = paths.join("");
  }

  // ---------- Höhenkarten rechts ----------
  function thumbs() {
    const side = App.$("ex-side");
    side.innerHTML = "";
    built.layers.slice().reverse().forEach((L) => {
      const f = document.createElement("figure"); f.className = "ex-thumb"; f.dataset.key = L.key;
      f.appendChild(heightmapCanvas(built.ref, L.year));
      const c = document.createElement("figcaption"); c.textContent = String(L.year); f.appendChild(c);
      side.appendChild(f);
    });
    const yr = App.state.year, a = D.area(g, yr), a0 = D.area(g, D.FIRST);
    const p = document.createElement("p"); p.className = "ex-note";
    p.textContent = a > 0 ? `${App.signed(a - a0)} km² since 1970. Areas are approximations, ice thickness is modelled.` : `${g.goneText}.`;
    side.appendChild(p);
    mark();
  }

  function show(glacier, st) {
    stage = st; root.hidden = false;
    if (!built || g.id !== glacier.id) build(glacier); else layout();
    built.group.visible = true;
  }
  function hide() { root.hidden = true; if (built) built.group.visible = false; }

  let pending = 0;
  function init() {
    root = App.$("gview");
    App.onChange((s, what) => {
      if (what === "route" || !built || root.hidden) return;
      cancelAnimationFrame(pending); pending = requestAnimationFrame(layout);   // höchstens einmal pro Frame neu aufbauen
    });
  }
  return { init, show, hide, place, isOn: () => !!built && !root.hidden };
})();
