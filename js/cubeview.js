/* =========================================================================
   Der Cube – ein Würfel, drei Inhalte
   overview : Eisblock (alles Eis von 1970), dreht sich bis zum Klick
   cube     : Berglandschaft der Alpen im Glaskasten, Gletscher als Eisflächen,
              Bohrkern-Zylinder und feine Beschriftungen – Jahr für Jahr
   glacier  : ein Gletscher als Stapel von Jahres-Layers (1985 → 2026),
              auf jedem Layer ein Zylinder = Eiskernbohrung
   ========================================================================= */
window.CubeView = (function () {
  const D = GLACIER_DATA;
  const LAYER_YEARS = [1985, 2000, 2015, 2026];
  let stage, ice, land, labels, stack = null, stackId = null;
  let spin = 0.45, spinTarget = 0.45, opening = false;
  const cores = [];               // { mesh, g, base } in der Landschaft
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();

  const CAM = {
    overview: { theta: 0.6, phi: 1.1, radius: 13.5, target: [0, 1.85, 0], shift: 0 },
    cube:     { theta: 0, phi: 0.96, radius: 17.5, target: [0, 0.15, 0.4], shift: 0.07 },
    glacier:  { theta: 0.38, phi: 1.3, radius: 18.5, target: [0, 2.35, 0], shift: 0.08 }
  };

  // ---------------- Landschaft (cube) ----------------
  function buildLandscape() {
    land = Scene3D.buildRelief({
      lon0: 6.75, lon1: 10.45, lat0: 45.84, lat1: 46.98, nx: 230, width: 12,
      vscale: 1.9, floor: 300, base: -0.3, glassH: 1.9, glassOpacity: 0.3, glassTint: 0.12, iceExag: 2.2
    });
    land.glaciers.forEach((o) => {
      const core = Scene3D.makeCore(0.26, 0.04);
      core.position.set(o.x, o.y, o.z);
      core.userData.glacier = o.g.id;
      land.group.add(core);
      cores.push({ mesh: core, o });
    });
    land.group.visible = false;
    stage.scene.add(land.group);
  }

  function landscapeLabels() {
    const v = new THREE.Vector3();
    labels.set(land.glaciers.map((o) => ({
      id: o.g.id, name: o.g.name, rank: o.g.a1973, small: o.g.a1973 < 8,
      pos: () => land.group.localToWorld(v.set(o.x, o.y + 0.3 * coreScale(o.g), o.z)).clone(),
      val: () => { const a = D.area(o.g, App.state.year); return a > 0 ? App.fmt(a) + " km²" : "verschwunden " + o.g.goneYear; },
      gone: () => D.area(o.g, App.state.year) <= 0
    })));
  }
  const coreScale = (g) => Math.max(0.0001, D.area(g, App.state.year) / g.a1973);

  // ---------------- Gletscher-Layers (glacier) ----------------
  function buildStack(g) {
    if (stack) { stage.scene.remove(stack.group); stack = null; }
    const group = new THREE.Group();
    const dLon = 0.2, dLat = 0.13, GAP = 1.55;
    const box = { lon0: g.lon - dLon, lon1: g.lon + dLon, lat0: g.lat - dLat, lat1: g.lat + dLat };
    let minE = 1e9;
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++)
      minE = Math.min(minE, Scene3D.elevAt(box.lon0 + (box.lon1 - box.lon0) * i / 10, box.lat0 + (box.lat1 - box.lat0) * j / 10));

    const layers = LAYER_YEARS.map((yr, i) => {
      const r = Scene3D.buildRelief({ ...box, nx: 120, width: 6.4, vscale: 1.45, floor: minE - 150, base: 0, glass: false, shadow: false,
                                      border: false, iceExag: 1.9, outsideFade: false, glacierMargin: 0, iceAlt: [1900, 2800], iceAltFloor: 0 });
      r.setYear(yr);
      r.group.position.y = i * GAP;
      // Bohrkerne: gross auf dem gewählten Gletscher, klein auf Nachbarn
      r.glaciers.forEach((o) => {
        const own = o.g.id === g.id, a = D.area(o.g, yr);
        if (a <= 0) return;
        const core = Scene3D.makeCore(own ? 0.5 : 0.2, own ? 0.07 : 0.032);
        core.scale.y = Math.max(0.15, a / o.g.a1973);
        core.position.set(o.x, o.y, o.z);
        r.group.add(core);
      });
      // Rahmen um das Layer – wird blau, wenn es das gewählte Jahr ist
      const frame = Scene3D.ringLine(3.2 + 0.02, r.DEP / 2 + 0.02, 0.002, Scene3D.C.ink, 0.25);
      r.group.add(frame);
      group.add(r.group);
      const own = r.glaciers.find((o) => o.g.id === g.id);
      return { yr, r, frame, own };
    });
    const H = (LAYER_YEARS.length - 1) * GAP + 1.25;
    group.add(Scene3D.glassBox(6.7, H, layers[0].r.DEP + 0.3, -0.06, 0.3, 0.1));
    group.add(Scene3D.groundShadow(11, 9, -0.07));
    group.visible = false;
    stage.scene.add(group);
    stack = { group, layers, g };
    stackId = g.id;
  }

  function stackLabels() {
    const v = new THREE.Vector3(), g = stack.g;
    labels.set(stack.layers.map((L) => ({
      id: "y" + L.yr, name: String(L.yr), rank: L.yr,
      pos: () => L.r.group.localToWorld(v.set(L.own ? L.own.x : 0, (L.own ? L.own.y : 0.5) + 0.55 * Math.max(0.15, D.area(g, L.yr) / g.a1973), L.own ? L.own.z : 0)).clone(),
      val: () => { const a = D.area(g, L.yr); return a > 0 ? App.fmt(a) + " km² · Bohrkern" : "verschwunden"; },
      gone: () => D.area(g, L.yr) <= 0
    })));
  }

  function activeLayerYear() {
    let best = LAYER_YEARS[0];
    LAYER_YEARS.forEach((y) => { if (y <= App.state.year) best = y; });
    return best;
  }

  // ---------------- Zustände ----------------
  function setMode(mode) {
    ice.group.visible = mode === "overview";
    land.group.visible = mode === "cube";
    if (mode === "glacier") {
      const g = App.glacierById(App.state.glacier);
      if (stackId !== g.id) buildStack(g);
      stack.group.visible = true;
      stackLabels();
    } else if (stack) stack.group.visible = false;
    if (mode === "cube") landscapeLabels();
    if (mode === "overview") { labels.clear(); spinTarget = 0.45; }
    stage.interactive = mode !== "overview";
    stage.orbit.autoRotate = 0;
    stage.flyTo(CAM[mode]);
    if (mode === "overview") stage.goal.theta = null; // im Übersichtsmodus dreht er frei weiter
    updateYear();
  }

  function updateYear() {
    const yr = App.state.year;
    ice.setYear(yr);
    land.setYear(yr);
    cores.forEach(({ mesh, o }) => { const s = coreScale(o.g); mesh.visible = s > 0.001; mesh.scale.y = Math.max(0.12, s); });
    if (stack) {
      const ay = activeLayerYear();
      stack.layers.forEach((L) => {
        const on = L.yr === ay;
        L.frame.material.color.copy(on ? Scene3D.C.blue : Scene3D.C.ink);
        L.frame.material.opacity = on ? 0.9 : 0.25;
      });
    }
    labels.refresh(App.state.mode === "glacier" ? "y" + activeLayerYear() : null);
  }

  // Klick auf einen Bohrkern in der Landschaft
  function pick(e) {
    if (App.state.mode !== "cube" || stage.moved > 5) return;
    const r = stage.renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, stage.camera);
    const hit = ray.intersectObjects(cores.map((c) => c.mesh), true)[0];
    if (hit) { let o = hit.object; while (o && !o.userData.glacier) o = o.parent; if (o) App.openGlacier(o.userData.glacier); }
  }

  function init() {
    stage = Scene3D.createStage(App.$("cube-stage"), { fov: 30, ...CAM.overview });
    ice = Scene3D.buildIceCube();
    stage.scene.add(ice.group);
    buildLandscape();

    labels = Scene3D.createLabels(App.$("cube-labels"), stage, {
      avoid: [".home-title h1:not([hidden])", "#info-card", "#tl-big"],
      onClick: (it) => {
        if (App.state.mode === "cube") App.openGlacier(it.id);
        else if (App.state.mode === "glacier") { Timeline.stop(); App.setYear(+it.name); }
      }
    });

    stage.onFrame = (dt) => {
      if (App.state.mode === "overview") {
        spin += (spinTarget - spin) * Math.min(1, dt * 3);
        stage.orbit.theta += spin * dt;
      }
      ice.tick(dt);
      if (App.state.mode !== "overview") labels.place(App.state.mode === "glacier" ? "y" + activeLayerYear() : null);
    };
    stage.renderer.domElement.addEventListener("pointerup", pick);

    // Klick auf den drehenden Cube: Drehung stoppt sanft, dann wird er gross
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
    });
    updateYear();
  }

  return { init };
})();
