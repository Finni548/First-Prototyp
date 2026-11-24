/* =========================================================================
   Karte (eigene Seite): Relief der ganzen Schweiz, drehbar & zoombar.
   Feine Beschriftungen; Klick auf einen Gletscher öffnet ihn im Cube.
   ========================================================================= */
window.MapView = (function () {
  const D = GLACIER_DATA;
  let stage, dio, labels;

  function init() {
    stage = Scene3D.createStage(App.$("map-stage"), { fov: 30, theta: 0, phi: 0.82, radius: 20, minR: 7, maxR: 30, target: [0, -0.1, 0.4], shift: 0.1, interactive: true });
    dio = Scene3D.buildRelief({ glassH: 2.0, iceExag: 3 });
    stage.scene.add(dio.group);
    stage.active = false;

    labels = Scene3D.createLabels(App.$("map-labels"), stage, {
      avoid: ["#page-map .detail-head h2", "#page-map .detail-head p", "#info-card"],
      onClick: (it) => App.openGlacier(it.id)
    });
    const v = new THREE.Vector3();
    labels.set(dio.glaciers.map((o) => ({
      id: o.g.id, name: o.g.name, rank: o.g.a1973, small: o.g.a1973 < 8,
      pos: () => v.set(o.x, o.y + 0.02, o.z).clone(),
      val: () => { const a = D.area(o.g, App.state.year); return a > 0 ? App.fmt(a) + " km²" : "verschwunden " + o.g.goneYear; },
      gone: () => D.area(o.g, App.state.year) <= 0
    })));
    stage.onFrame = () => labels.place();

    App.onChange((s, what) => {
      if (what === "route") { stage.active = s.page === "map"; if (stage.active) stage.resize(); }
      dio.setYear(s.year); labels.refresh();
    });
    dio.setYear(App.state.year);
  }

  return { init };
})();
