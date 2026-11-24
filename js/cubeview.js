/* =========================================================================
   Der Cube – derselbe Würfel in drei Zuständen
   overview : Eisblock aller Gletscher dreht sich, Jahres-Ebenen fein sichtbar
   cube     : Klick → er hört auf zu drehen und wird gross.
              Jede Jahres-Ebene liegt übereinander; die gemeinte LEUCHTET
              (Jahr der Zeitleiste, Maus, angeklickte = festgehalten).
              Bohrkern-Zylinder der grössten Gletscher → Klick öffnet den Gletscher
   glacier  : genau derselbe Aufbau, aber nur für EINEN Gletscher
              (Relief um den Gletscher, Eis-Anteil aus seiner Flächenänderung).
              Dahinter: das Berg-Foto mit Cutout-Fenster (glacierview.js)
   ========================================================================= */
window.CubeView = (function () {
  const D = GLACIER_DATA;
  let stage, ice, labels;          // ice = Würfel aller Gletscher
  let gcube = null, gId = null;    // gcube = Würfel eines Gletschers
  let spin = 0.45, spinTarget = 0.45, opening = false;
  let hoverYear = null;
  const pinned = new Set();
  const cores = [];                // { mesh, g, peak } im grossen Würfel
  let gcores = [];                 // Bohrkerne im Gletscher-Würfel
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();

  const CAM = {
    overview: { theta: 0.6, phi: 1.12, radius: 17, target: [0, 1.9, 0], shift: 0 },
    cube:     { theta: 0.55, phi: 1.16, radius: 12.6, target: [0, 1.75, 0], shift: 0 },
    glacier:  { theta: 0.55, phi: 1.12, radius: 17.5, target: [0, 1.8, 0], shift: -0.01 }
  };

  // im Hintergrund / klein dreht sich der Würfel weiter
  const spinning = () => ["overview", "map", "area"].includes(App.state.mode);
  const big = () => App.state.mode === "cube" || App.state.mode === "glacier";
  // aktiver Würfel + wie seine Werte beschrieben werden
  const cur = () => (App.state.mode === "glacier" && gcube ? gcube : ice);
  const curG = () => App.glacierById(App.state.glacier);
  function valueText(y) {
    if (App.state.mode === "glacier" && gcube) {
      const g = curG(), a = D.area(g, y);
      return a > 0 ? `${App.fmt(a)} km², ${App.fmt(gcube.frac(y) * 100, 0)} % Eis` : "verschwunden";
    }
    return `${App.fmt(D.vol(y))} km³, ${App.fmt(D.vol(y) / D.V0 * 100, 0)} %`;
  }

  const lit = () => [...pinned, ...(hoverYear ? [hoverYear] : [])];
  function relight() { cur().highlight(lit()); markYears(); }

  function addHitBox(obj) {
    const hb = new THREE.Mesh(new THREE.BoxGeometry(obj.CUBE, obj.CUBE, obj.CUBE), new THREE.MeshBasicMaterial({ visible: false }));
    hb.position.y = obj.CUBE / 2; obj.group.add(hb); obj.hitBox = hb;
  }

  // ---------------- grosser Würfel: Bohrkerne der grössten Gletscher ----------------
  function buildCores() {
    const big = D.glaciers.filter((g) => !g.goneYear).sort((a, b) => b.a1973 - a.a1973).slice(0, ice.peaks.length);
    big.forEach((g, i) => {
      const mesh = Scene3D.makeCore(0.42, 0.055);
      mesh.userData.glacier = g.id;
      ice.group.add(mesh);
      cores.push({ mesh, g, peak: ice.peaks[i] });
    });
    addHitBox(ice);
  }
  const coreScale = (g) => Math.max(0.12, D.area(g, App.state.year) / g.a1973);

  // ---------------- Gletscher-Würfel (gleicher Aufbau, ein Gletscher) ----------------
  function buildGlacierCube(g) {
    if (gcube) { stage.scene.remove(gcube.group); gcube = null; }
    const a0 = D.area(g, D.FIRST);
    gcube = Scene3D.buildIceCube({
      lon: g.lon, lat: g.lat, span: 26,
      frac: (y) => Math.pow(Math.max(0, D.area(g, y) / a0), 1.36)   // Volumen ~ Fläche^1.36 (Volumen-Flächen-Beziehung)
    });
    addHitBox(gcube);
    gcores = gcube.peaks.slice(0, 3).map((peak, i) => {
      const mesh = Scene3D.makeCore(0.5, 0.06);
      gcube.group.add(mesh);
      return { mesh, peak, n: i + 1 };
    });
    gcube.group.visible = false;
    stage.scene.add(gcube.group);
    gId = g.id;
  }

  // ---------------- Beschriftungen ----------------
  function topLabels() {
    const v = new THREE.Vector3();
    if (App.state.mode === "cube") {
      labels.set(cores.map((c) => ({
        id: c.g.id, name: c.g.name, rank: c.g.a1973,
        pos: () => ice.group.localToWorld(ice.surfaceAt(c.peak).add(v.set(0, 0.42 * coreScale(c.g), 0))).clone(),
        val: () => App.fmt(D.area(c.g, App.state.year)) + " km²"
      })));
    } else if (App.state.mode === "glacier" && gcube) {
      labels.set(gcores.map((c) => ({
        id: "core" + c.n, name: "Bohrkern " + c.n, rank: 10 - c.n,
        pos: () => gcube.group.localToWorld(gcube.surfaceAt(c.peak).add(v.set(0, 0.5 * Math.max(0.12, gcube.frac(App.state.year)), 0))).clone(),
        val: () => `${App.fmt(gcube.frac(App.state.year) * 100, 0)} % Eis von 1970`
      })));
    } else labels.clear();
    yearLabels();
  }

  // Jahre: rechts neben dem Würfel, sauber untereinander, mit feiner Linie zur Ebene
  let yLayer, ySvg, yItems = [];
  function yearLabels() {
    yLayer.querySelectorAll(".ylab").forEach((e) => e.remove());
    ySvg.innerHTML = ""; yItems = [];
    if (!big()) return;
    const yr = App.state.year;
    const years = D.years.filter((y) => y <= yr && (y === D.FIRST || y === yr || y % 10 === 0 || D.hotSummers[y] || pinned.has(y)));
    yItems = years.map((y) => {
      const el = document.createElement("div");
      el.className = "ylab" + (D.hotSummers[y] ? " hot" : "");
      el.innerHTML = `<b>${y}</b><span>${valueText(y)}</span>`;
      el.addEventListener("mouseenter", () => { hoverYear = y; relight(); });
      el.addEventListener("mouseleave", () => { hoverYear = null; relight(); });
      el.addEventListener("click", (e) => { e.stopPropagation(); togglePin(y); });
      yLayer.appendChild(el);
      return { y, el };
    });
    markYears();
  }
  function markYears() {
    const L = lit();
    yItems.forEach(({ y, el }) => el.classList.toggle("lit", L.includes(y) || y === App.state.year));
  }
  function placeYears() {
    if (!yItems.length) return;
    const obj = cur();
    const w = stage.container.clientWidth, h = stage.container.clientHeight, v = new THREE.Vector3();
    let maxX = 0;
    const pts = yItems.map((it) => {
      let best = null;
      obj.rimCorners(it.y).forEach((p) => {
        obj.group.localToWorld(v.copy(p)).project(stage.camera);
        const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        if (!best || x > best.x) best = { x, y };
      });
      maxX = Math.max(maxX, best.x);
      return { it, ...best };
    });
    const LX = Math.min(maxX + 40, w - 160);
    pts.sort((a, b) => a.y - b.y);
    let last = -Infinity, svg = "";
    pts.forEach((p) => {
      const ly = Math.max(p.y, last + 30); last = ly;
      p.it.el.style.transform = `translate(${LX.toFixed(1)}px, ${(ly - 14).toFixed(1)}px)`;
      const cls = p.it.el.classList.contains("lit") ? "lit" : p.it.el.classList.contains("hot") ? "hot" : "";
      svg += `<path class="${cls}" d="M${p.x.toFixed(1)},${p.y.toFixed(1)} L${(LX - 14).toFixed(1)},${p.y.toFixed(1)} L${(LX - 2).toFixed(1)},${ly.toFixed(1)}"/>`;
    });
    ySvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    ySvg.innerHTML = svg;
  }

  // ---------------- Zustände ----------------
  let lastMode = null;
  function setMode(mode) {
    if (mode !== lastMode) { pinned.clear(); hoverYear = null; }
    lastMode = mode;
    const showG = mode === "glacier" || mode === "area";      // Würfel eines Gletschers
    if (showG) { const g = curG(); if (gId !== g.id) buildGlacierCube(g); }
    if (mode === "glacier") GlacierView.show(curG()); else GlacierView.hide();
    ice.group.visible = !showG;
    if (gcube) gcube.group.visible = showG;
    cores.forEach((c) => (c.mesh.visible = mode === "cube"));
    stage.active = mode !== "probe";
    if (spinning()) spinTarget = 0.45;
    stage.interactive = mode === "cube" || mode === "glacier";
    stage.flyTo(CAM[CAM[mode] ? mode : "overview"]);
    if (spinning()) stage.goal.theta = null;
    updateYear();
  }

  function updateYear() {
    const yr = App.state.year;
    ice.setYear(yr); ice.highlight(App.state.mode === "glacier" ? [] : lit());
    if (gcube) { gcube.setYear(yr); gcube.highlight(App.state.mode === "glacier" ? lit() : []); }
    topLabels();
  }

  // ---------------- Maus: Ebene leuchten / festhalten / Gletscher öffnen ----------------
  function rayFrom(e) {
    const r = stage.renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, stage.camera);
  }
  let lastMove = 0;
  function onMove(e) {
    if (!big() || stage.dragging) return;
    const now = performance.now(); if (now - lastMove < 40) return; lastMove = now;
    rayFrom(e);
    const obj = cur();
    const coreHit = App.state.mode === "cube" && ray.intersectObjects(cores.map((c) => c.mesh), true)[0];
    stage.renderer.domElement.style.cursor = coreHit ? "pointer" : "";
    const hit = ray.intersectObject(obj.hitBox)[0];
    const y = hit ? hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(obj.group.matrixWorld).invert()).y : null;
    const yr = y != null ? obj.yearAtHeight(y) : null;
    if (yr !== hoverYear) { hoverYear = yr; relight(); }
    if (yr) App.showTip(`<b>${yr}</b>, ${valueText(yr)}${D.hotSummers[yr] ? '<br><span class="t-hot">Heisser Sommer</span>' : ""}<br><span class="t-dim">Klicken, um die Ebene festzuhalten</span>`, e);
    else App.hideTip();
  }
  function onLeave() { if (hoverYear) { hoverYear = null; relight(); } App.hideTip(); }
  function onClick(e) {
    if (!big() || stage.moved > 5) return;
    rayFrom(e);
    if (App.state.mode === "cube") {
      const coreHit = ray.intersectObjects(cores.map((c) => c.mesh), true)[0];
      if (coreHit) { let o = coreHit.object; while (o && !o.userData.glacier) o = o.parent; if (o) return App.openGlacier(o.userData.glacier); }
    }
    if (hoverYear) togglePin(hoverYear);
  }
  function togglePin(y) { pinned.has(y) ? pinned.delete(y) : pinned.add(y); relight(); App.emit("pins"); }

  function init() {
    stage = Scene3D.createStage(App.$("cube-stage"), { fov: 30, ...CAM.overview });
    ice = Scene3D.buildIceCube();
    stage.scene.add(ice.group);
    buildCores();

    yLayer = App.$("cube-years");
    ySvg = yLayer.querySelector("svg");
    labels = Scene3D.createLabels(App.$("cube-labels"), stage, {
      avoid: [".home-title h1", "#info-card", "#pin-bar", "#cube-years .ylab", "#gv-table"],
      onClick: (it) => { if (App.state.mode === "cube") App.openGlacier(it.id); }
    });

    stage.onFrame = (dt) => {
      if (spinning()) { spin += (spinTarget - spin) * Math.min(1, dt * 3); stage.orbit.theta += spin * dt; }
      ice.tick(dt);
      cores.forEach((c) => { c.mesh.position.copy(ice.surfaceAt(c.peak)); c.mesh.scale.y = coreScale(c.g); });
      if (gcube) {
        gcube.tick(dt);
        const s = Math.max(0.12, gcube.frac(App.state.year));
        gcores.forEach((c) => { c.mesh.position.copy(gcube.surfaceAt(c.peak)); c.mesh.scale.y = s; });
      }
      if (big()) { labels.place(); placeYears(); }
    };
    const el = stage.renderer.domElement;
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerup", onClick);

    App.$("pin-clear").addEventListener("click", (e) => { e.stopPropagation(); pinned.clear(); relight(); App.emit("pins"); });

    const panel = App.$("panel-cube");
    const open = () => {
      if (App.state.mode === "map") return App.go("cube");
      if (App.state.mode === "area") return App.openGlacier(App.state.glacier);
      if (App.state.mode !== "overview" || opening) return;
      opening = true; spinTarget = 0;
      setTimeout(() => { App.go("cube"); opening = false; }, 650);
    };
    panel.addEventListener("click", open);
    panel.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });

    App.onChange((s, what) => {
      if (what === "route") setMode(s.mode);
      else updateYear();
      App.$("pin-bar").hidden = !(big() && pinned.size);
      App.$("pin-count").textContent = pinned.size === 1 ? "1 Ebene festgehalten" : pinned.size + " Ebenen festgehalten";
    });
    updateYear();
  }

  return { init };
})();
