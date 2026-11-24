/* =========================================================================
   Der Cube – derselbe blaue Eisblock auf der Startseite und gross
   overview : Eisblock dreht sich, Jahres-Ebenen fein sichtbar
   cube     : Klick → er hört auf zu drehen und wird gross.
              Jede Jahres-Ebene (Eis-Oberfläche des Jahres) liegt übereinander.
              Die gemeinte Ebene LEUCHTET: das Jahr der Zeitleiste, die Ebene
              unter der Maus und alle angeklickten (festgehaltenen) Ebenen.
              Auf den Gipfeln: Bohrkern-Zylinder der grössten Gletscher.
   glacier  : ein Gletscher als Stapel von Jahres-Layers (1985 → 2026)
   ========================================================================= */
window.CubeView = (function () {
  const D = GLACIER_DATA;
  let stage, ice, labels;
  let spin = 0.45, spinTarget = 0.45, opening = false;
  let hoverYear = null;
  const pinned = new Set();
  const cores = [];
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let hitBox;

  const CAM = {
    overview: { theta: 0.6, phi: 1.1, radius: 13.5, target: [0, 1.85, 0], shift: 0 },
    cube:     { theta: 0.55, phi: 1.16, radius: 12.6, target: [0, 1.75, 0], shift: 0.0 },
    glacier:  { theta: 0.55, phi: 1.16, radius: 12.6, target: [0, 1.75, 0], shift: 0 }
  };

  const lit = () => [...pinned, ...(hoverYear ? [hoverYear] : [])];
  function relight() { ice.highlight(lit()); markYears(); }

  // ---------------- Bohrkerne der grössten Gletscher auf den Gipfeln ----------------
  function buildCores() {
    const big = D.glaciers.filter((g) => !g.goneYear).sort((a, b) => b.a1973 - a.a1973).slice(0, ice.peaks.length);
    big.forEach((g, i) => {
      const mesh = Scene3D.makeCore(0.42, 0.055);
      mesh.userData.glacier = g.id;
      ice.group.add(mesh);
      cores.push({ mesh, g, peak: ice.peaks[i] });
    });
    hitBox = new THREE.Mesh(new THREE.BoxGeometry(ice.CUBE, ice.CUBE, ice.CUBE), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.position.y = ice.CUBE / 2;
    ice.group.add(hitBox);
  }
  const coreScale = (g) => Math.max(0.12, D.area(g, App.state.year) / g.a1973);

  // ---------------- Beschriftungen im grossen Cube ----------------
  // Gletscher: feine Leitlinien nach oben (createLabels)
  function cubeLabels() {
    const v = new THREE.Vector3();
    labels.set(cores.map((c) => ({
      id: c.g.id, name: c.g.name, rank: c.g.a1973, kind: "glacier",
      pos: () => ice.group.localToWorld(ice.surfaceAt(c.peak).add(v.set(0, 0.42 * coreScale(c.g), 0))).clone(),
      val: () => App.fmt(D.area(c.g, App.state.year)) + " km² · Bohrkern"
    })));
    yearLabels();
  }

  // Jahre: rechts neben dem Würfel, sauber untereinander, mit feiner Linie zur Ebene
  let yLayer, ySvg, yItems = [];
  function yearLabels() {
    yLayer.querySelectorAll(".ylab").forEach((e) => e.remove());
    ySvg.innerHTML = ""; yItems = [];
    if (App.state.mode !== "cube") return;
    const yr = App.state.year;
    const years = D.years.filter((y) => y <= yr && (y === D.FIRST || y === yr || y % 10 === 0 || D.hotSummers[y] || pinned.has(y)));
    yItems = years.map((y) => {
      const el = document.createElement("div");
      el.className = "ylab" + (D.hotSummers[y] ? " hot" : "");
      el.innerHTML = `<b>${y}</b><span>${App.fmt(D.vol(y))} km³ · ${App.fmt(D.vol(y) / D.V0 * 100, 0)} %</span>`;
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
    const w = stage.container.clientWidth, h = stage.container.clientHeight, v = new THREE.Vector3();
    let maxX = 0;
    const pts = yItems.map((it) => {
      let best = null;
      ice.rimCorners(it.y).forEach((p) => {
        ice.group.localToWorld(v.copy(p)).project(stage.camera);
        const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        if (!best || x > best.x) best = { x, y };
      });
      maxX = Math.max(maxX, best.x);
      return { it, ...best };
    });
    const LX = Math.min(maxX + 40, w - 150);
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
  function setMode(mode) {
    ice.group.visible = mode !== "glacier";
    stage.active = App.state.page === "home" && mode !== "glacier";
    cores.forEach((c) => (c.mesh.visible = mode === "cube"));
    if (mode === "glacier") { labels.clear(); GlacierView.show(App.glacierById(App.state.glacier)); }
    else GlacierView.hide();
    if (mode === "cube") cubeLabels();
    if (mode !== "cube") yearLabels();
    if (mode === "overview") { labels.clear(); spinTarget = 0.45; hoverYear = null; }
    stage.interactive = mode !== "overview";
    stage.flyTo(CAM[mode]);
    if (mode === "overview") stage.goal.theta = null;
    updateYear();
  }

  function updateYear() {
    const yr = App.state.year;
    ice.setYear(yr);
    ice.highlight(lit());
    if (App.state.mode === "cube") cubeLabels();
  }

  // ---------------- Maus: Ebene leuchten lassen / festhalten / Gletscher öffnen ----------------
  function rayFrom(e) {
    const r = stage.renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, stage.camera);
  }
  let lastMove = 0;
  function onMove(e) {
    if (App.state.mode !== "cube" || stage.dragging) return;
    const now = performance.now(); if (now - lastMove < 40) return; lastMove = now;
    rayFrom(e);
    const coreHit = ray.intersectObjects(cores.map((c) => c.mesh), true)[0];
    stage.renderer.domElement.style.cursor = coreHit ? "pointer" : "";
    const hit = ray.intersectObject(hitBox)[0];
    const y = hit ? hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(ice.group.matrixWorld).invert()).y : null;
    const yr = y != null ? ice.yearAtHeight(y) : null;
    if (yr !== hoverYear) { hoverYear = yr; relight(); }
    if (yr) App.showTip(`<b>${yr}</b> · ${App.fmt(D.vol(yr))} km³${D.hotSummers[yr] ? ' · <span style="color:#e8743b">heisser Sommer</span>' : ""}<br><span style="color:#8a8d96">Klick: Ebene festhalten</span>`, e);
    else App.hideTip();
  }
  function onLeave() { if (hoverYear) { hoverYear = null; relight(); } App.hideTip(); }
  function onClick(e) {
    if (App.state.mode !== "cube" || stage.moved > 5) return;
    rayFrom(e);
    const coreHit = ray.intersectObjects(cores.map((c) => c.mesh), true)[0];
    if (coreHit) { let o = coreHit.object; while (o && !o.userData.glacier) o = o.parent; if (o) return App.openGlacier(o.userData.glacier); }
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
      avoid: [".home-title h1", "#info-card", "#pin-bar", "#cube-years .ylab"],
      onClick: (it) => {
        if (App.state.mode === "cube") App.openGlacier(it.id);
      },
    });

    stage.onFrame = (dt) => {
      if (App.state.mode === "overview") { spin += (spinTarget - spin) * Math.min(1, dt * 3); stage.orbit.theta += spin * dt; }
      ice.tick(dt);
      cores.forEach((c) => { c.mesh.position.copy(ice.surfaceAt(c.peak)); c.mesh.scale.y = coreScale(c.g); });
      if (App.state.mode === "cube") labels.place();
      if (App.state.mode === "cube") placeYears();
    };
    const el = stage.renderer.domElement;
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerup", onClick);

    App.$("pin-clear").addEventListener("click", (e) => { e.stopPropagation(); pinned.clear(); relight(); App.emit("pins"); });

    const panel = App.$("panel-cube");
    const open = () => {
      if (App.state.mode !== "overview" || opening) return;
      opening = true; spinTarget = 0;
      setTimeout(() => { App.go("cube"); opening = false; }, 650);
    };
    panel.addEventListener("click", open);
    panel.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });

    App.onChange((s, what) => {
      if (what === "route") { stage.active = s.page === "home"; if (s.page === "home") setMode(s.mode); }
      else updateYear();
      App.$("pin-bar").hidden = !(s.page === "home" && s.mode === "cube" && pinned.size);
      App.$("pin-count").textContent = pinned.size === 1 ? "1 Ebene festgehalten" : pinned.size + " Ebenen festgehalten";
    });
    updateYear();
  }

  return { init };
})();
