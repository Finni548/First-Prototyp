/* =========================================================================
   Karten-Weg (Skizze 1A / 2A) – alles im Karten-Panel der Startseite
   overview : kleine Karte links (reagiert auf die Maus)
   map      : Klick → Karte wird gross, der Cube rückt in den Hintergrund.
              Feine Beschriftungen; Gletscher anklicken →
   area     : das Gebiet eines Gletschers gross als 3D-Topografie mit
              Höhenlinien, Eisflächen und Bohrkern-Zylindern; Cube klein unten rechts.
              Bohrkern anklicken →
   probe    : Karte klein oben links, daneben die Kernbohrung (probe.js)
   ========================================================================= */
window.MapView = (function () {
  const D = GLACIER_DATA;
  let stage, dio, labels, area = null, areaId = null, tilt = 0;
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();

  const CAM = {
    overview: { theta: -0.3, phi: 0.9, radius: 17.5, target: [0, 0.35, 0], shift: 0 },
    map:      { theta: 0, phi: 0.84, radius: 16.5, target: [0, -0.1, 0.3], shift: 0.06 },
    area:     { theta: 0.25, phi: 0.92, radius: 24, target: [0, 0.6, 0], shift: 0.06 },
    probe:    { theta: 0.35, phi: 0.88, radius: 23, target: [0, 0.5, 0], shift: 0 }
  };

  // ---------- Bohrkerne eines Gletscher-Gebiets ----------
  // 3 schematische Punkte auf dem Gletscher + echte Bohrungen, falls sie im Gebiet liegen
  function coresFor(g) {
    const box = boxFor(g), s = Math.max(0.6, Math.sqrt(g.a1973) / 9);
    const list = [[0, 0], [-0.03, 0.012], [0.028, -0.016]].map(([dl, db], i) => ({
      id: "k" + (i + 1), name: "Bohrkern " + (i + 1), lon: g.lon + dl * s, lat: g.lat + db * s, real: false
    }));
    D.realCores.forEach((c) => {
      if (c.lon > box.lon0 && c.lon < box.lon1 && c.lat > box.lat0 && c.lat < box.lat1) list.push({ ...c, real: true });
    });
    return list;
  }
  const boxFor = (g) => ({ lon0: g.lon - 0.16, lon1: g.lon + 0.16, lat0: g.lat - 0.11, lat1: g.lat + 0.11 });

  function buildArea(g) {
    if (area) stage.scene.remove(area.r.group);
    const box = boxFor(g);
    let minE = 1e9;
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++)
      minE = Math.min(minE, Scene3D.elevAt(box.lon0 + (box.lon1 - box.lon0) * i / 12, box.lat0 + (box.lat1 - box.lat0) * j / 12));
    const r = Scene3D.buildRelief({ ...box, nx: 170, width: 10, vscale: 3.2, floor: minE - 250, base: -0.25,
      glassH: 3.0, glassOpacity: 0.25, glassTint: 0.1, iceExag: 1.25, outsideFade: false, glacierMargin: 0,
      iceAlt: [1900, 2800], iceAltFloor: 0, contours: 100 });
    const cores = coresFor(g).map((c) => {
      const mesh = Scene3D.makeCore(c.real ? 0.7 : 0.5, c.real ? 0.085 : 0.065);
      mesh.position.set(r.lonToX(c.lon), r.heightAt(c.lon, c.lat), r.latToZ(c.lat));
      mesh.userData.core = c.id;
      if (c.real) mesh.children.forEach((m) => m.material && m.material.color && m.material.color.set && m.geometry.type !== "CylinderGeometry" && m.material.color.set("#e8743b"));
      r.group.add(mesh);
      return { c, mesh };
    });
    stage.scene.add(r.group);
    area = { r, cores, g };
    areaId = g.id;
  }

  // ---------- Beschriftungen ----------
  function setLabels(mode) {
    const v = new THREE.Vector3();
    if (mode === "map") {
      labels.set(dio.glaciers.map((o) => ({
        id: o.g.id, name: o.g.name, rank: o.g.a1973, small: o.g.a1973 < 8,
        pos: () => v.set(o.x, o.y + 0.02, o.z).clone(),
        val: () => { const a = D.area(o.g, App.state.year); return a > 0 ? App.fmt(a) + " km²" : "verschwunden " + o.g.goneYear; },
        gone: () => D.area(o.g, App.state.year) <= 0
      })));
    } else if (mode === "area" && area) {
      labels.set(area.cores.map(({ c, mesh }) => ({
        id: c.id, name: c.real ? c.name + " · echte Bohrung" : c.name, rank: c.real ? 100 : 10,
        pos: () => area.r.group.localToWorld(v.copy(mesh.position).add(new THREE.Vector3(0, c.real ? 0.72 : 0.52, 0))).clone(),
        val: () => c.real ? `${c.drilled} · ${c.length} m` : "schematisch · Klick für Details"
      })));
    } else labels.clear();
  }

  function onRoute(s) {
    const mode = s.mode;
    const own = ["map", "area", "probe"].includes(mode);
    stage.active = mode !== "glacier";
    if ((mode === "area" || mode === "probe") && areaId !== s.glacier) buildArea(App.glacierById(s.glacier));
    const showArea = mode === "area" || mode === "probe";
    dio.group.visible = !showArea;
    if (area) area.r.group.visible = showArea;
    stage.interactive = mode === "map" || mode === "area";
    stage.flyTo(CAM[own ? mode : "overview"]);
    setLabels(mode);
    updateYear();
  }
  function updateYear() {
    dio.setYear(App.state.year);
    if (area) { area.r.setYear(App.state.year); }
    labels.refresh(App.state.core);
  }

  function pick(e) {
    if (App.state.mode !== "area" || stage.moved > 5 || !area) return;
    const r = stage.renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, stage.camera);
    const hit = ray.intersectObjects(area.cores.map((c) => c.mesh), true)[0];
    if (hit) { let o = hit.object; while (o && !o.userData.core) o = o.parent; if (o) App.openProbe(area.g.id, o.userData.core); }
  }

  function init() {
    stage = Scene3D.createStage(App.$("home-map-stage"), { fov: 28, ...CAM.overview });
    dio = Scene3D.buildRelief({ glassH: 2.4 });
    stage.scene.add(dio.group);

    labels = Scene3D.createLabels(App.$("map-labels"), stage, {
      avoid: [".home-title h1", "#info-card", "#panel-cube"],
      onClick: (it) => {
        if (App.state.mode === "map") App.go("area/" + it.id);
        else if (App.state.mode === "area") App.openProbe(area.g.id, it.id);
      }
    });

    const panel = App.$("panel-map");
    panel.addEventListener("pointermove", (e) => { const r = panel.getBoundingClientRect(); tilt = (e.clientX - r.left) / r.width - 0.5; });
    panel.addEventListener("pointerleave", () => (tilt = 0));
    stage.onFrame = (dt) => {
      if (App.state.mode === "overview" || App.state.mode === "cube" || App.state.mode === "probe") {
        const o = stage.orbit, base = App.state.mode === "probe" ? CAM.probe.theta : CAM.overview.theta;
        if (!stage.goal || stage.goal.theta == null) o.theta += ((base + tilt * 0.5) - o.theta) * Math.min(1, dt * 3);
      }
      if (App.state.mode === "map" || App.state.mode === "area") labels.place(App.state.core);
    };
    stage.renderer.domElement.addEventListener("pointerup", pick);
    panel.addEventListener("click", () => {
      if (App.state.mode === "overview") App.go("map");
      else if (App.state.mode === "cube") App.go("map");
      else if (App.state.mode === "probe") App.go("area/" + App.state.glacier);
    });
    panel.addEventListener("keydown", (e) => { if (e.key === "Enter" && App.state.mode === "overview") App.go("map"); });

    App.onChange((s, what) => { if (what === "route") onRoute(s); else updateYear(); });
    dio.setYear(App.state.year);
  }

  return { init, coresFor };
})();
