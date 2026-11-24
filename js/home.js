/* =========================================================================
   Startseite: wechselndes Wort in der Headline + die zwei 3D-Cubes
   links: Relief-Karte im Glaskasten · rechts: Eisblock, dreht sich bis zum Klick
   ========================================================================= */
window.Home = (function () {
  let mapStage, cubeStage, dio, ice;
  let spin = 0.45, spinTarget = 0.45, stopping = false;

  function rotator() {
    const words = ["schmilzt.", "verschwindet.", "wird zu Wasser.", "verändert die Alpen."];
    const el = document.querySelector(".rotator");
    let i = 0;
    setInterval(() => {
      if (App.state.page !== "home") return;
      const old = el.querySelector(".rot-word");
      old.classList.add("out");
      setTimeout(() => {
        i = (i + 1) % words.length;
        el.innerHTML = `<span class="rot-word">${words[i]}</span>`;
      }, 420);
    }, 2800);
  }

  function init() {
    rotator();

    // ---- links: Karte ----
    mapStage = Scene3D.createStage(App.$("home-map-stage"), { fov: 28, theta: -0.3, phi: 0.9, radius: 17.5, target: [0, 0.35, 0] });
    dio = Scene3D.buildDiorama({ glassH: 2.4 });
    mapStage.scene.add(dio.group);
    const card = App.$("home-map-stage").closest(".cube-card");
    let tilt = 0;
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      tilt = ((e.clientX - r.left) / r.width - 0.5);
    });
    card.addEventListener("pointerleave", () => (tilt = 0));
    mapStage.onFrame = (dt) => {
      const o = mapStage.orbit;
      o.theta += ((-0.3 + tilt * 0.5) - o.theta) * Math.min(1, dt * 3);
    };

    // ---- rechts: Eisblock, dreht dauerhaft ----
    cubeStage = Scene3D.createStage(App.$("home-cube-stage"), { fov: 28, theta: 0.6, phi: 1.1, radius: 13.5, target: [0, 1.85, 0] });
    ice = Scene3D.buildIceCube({ rings: false });
    cubeStage.scene.add(ice.group);
    cubeStage.onFrame = (dt) => {
      spin += (spinTarget - spin) * Math.min(1, dt * 3);
      cubeStage.orbit.theta += spin * dt;
      ice.tick(dt);
    };

    App.$("home-cube-card").addEventListener("click", () => {
      if (stopping) return;
      stopping = true;
      spinTarget = 0;                      // Drehung stoppt sanft …
      setTimeout(() => {                   // … dann öffnet sich der Würfel
        App.go("cube");
        stopping = false;
      }, 750);
    });

    App.onChange((s) => { dio.setYear(s.year); ice.setYear(s.year); });
    dio.setYear(App.state.year); ice.setYear(App.state.year);

    App.registerPage("home", {
      show() { mapStage.active = cubeStage.active = true; spinTarget = 0.45; mapStage.resize(); cubeStage.resize(); },
      hide() { mapStage.active = cubeStage.active = false; }
    });
  }

  return { init };
})();
