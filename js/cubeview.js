/* =========================================================================
   Eisblock: alles Schweizer Gletschereis von 1970 als Glaswürfel.
   Der Eisblock (Oberfläche = Berglandschaft aus Eis) sinkt mit jedem Jahr.
   Ringe am Glas markieren den Stand nach heissen Sommern.
   ========================================================================= */
window.CubeView = (function () {
  const D = GLACIER_DATA;
  let stage, ice, layer;
  let rings = [];
  const v3 = new THREE.Vector3();

  function buildRingLabels() {
    layer.innerHTML = "";
    const yr = App.state.year;
    rings = [{ f: 1, text: `<b>1970</b> · ${App.fmt(D.V0)} km³ · 100 %`, cls: "" }];
    for (let y = D.FIRST + 1; y < yr; y++) {
      if (D.hotSummers[y]) rings.push({ f: D.vol(y) / D.V0, text: `<b>${y}</b> · ${App.signed(D.changePct(y))} % in einem Sommer`, cls: "hot" });
    }
    const f = D.vol(yr) / D.V0;
    rings.push({ f, text: `<b>${yr}</b> · ${App.fmt(D.vol(yr))} km³ · ${App.fmt(f * 100, 0)} %`, cls: "now" });
    rings.forEach((r) => {
      r.el = document.createElement("div");
      r.el.className = "ring-label " + r.cls;
      r.el.innerHTML = r.text;
      layer.appendChild(r.el);
    });
  }

  function placeRingLabels() {
    const w = stage.container.clientWidth, h = stage.container.clientHeight, c = ice.CUBE / 2;
    const pos = rings.map((r) => {
      const y = ice.levelY(r.f);
      let best = null;
      [[-c, -c], [c, -c], [c, c], [-c, c]].forEach(([x, z]) => {
        v3.set(x, y, z).project(stage.camera);
        const sx = (v3.x * 0.5 + 0.5) * w, sy = (-v3.y * 0.5 + 0.5) * h;
        if (!best || sx > best.x) best = { x: sx, y: sy };
      });
      return { r, ...best };
    });
    // von oben nach unten verteilen, damit nichts überlappt
    pos.sort((a, b) => a.y - b.y);
    let last = -Infinity;
    pos.forEach((p) => {
      const ly = Math.max(p.y, last + 16); last = ly;
      p.r.el.style.transform = `translate(${(p.x + 14).toFixed(1)}px, ${(ly - 7).toFixed(1)}px)`;
    });
  }

  function init() {
    layer = App.$("cube-labels");
    stage = Scene3D.createStage(App.$("cube-stage"), { fov: 30, theta: 0.65, phi: 1.1, radius: 16, minR: 8, maxR: 24, target: [0, 1.8, 0], shift: 0.12, interactive: true });
    ice = Scene3D.buildIceCube({ rings: true });
    stage.scene.add(ice.group);
    stage.onFrame = (dt) => { ice.tick(dt); placeRingLabels(); };
    stage.active = false;

    App.onChange((s) => { ice.setYear(s.year); buildRingLabels(); });
    ice.setYear(App.state.year); buildRingLabels();

    App.registerPage("cube", {
      show() { stage.active = true; stage.resize(); },
      hide() { stage.active = false; }
    });
  }

  return { init };
})();
