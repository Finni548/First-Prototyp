/* =========================================================================
   3D-Kern (Three.js): Bühne mit Kamera-Steuerung, Relief-Diorama, Eisblock
   Wird von Startseite, Karte und Eisblock-Ansicht gemeinsam benutzt.
   ========================================================================= */
window.Scene3D = (function () {
  const T = window.SWISS_TERRAIN, D = window.GLACIER_DATA;

  // ---------- Farben (hell, wie die Referenz-Website) ----------
  const C = {
    land:   new THREE.Color("#e3dfd6"),
    rock:   new THREE.Color("#b9b1a2"),
    high:   new THREE.Color("#f3f1ec"),
    out:    new THREE.Color("#f2efe8"),
    outHi:  new THREE.Color("#faf9f6"),
    lake:   new THREE.Color("#b7d3ec"),
    ice:    new THREE.Color("#7fb8ec"),
    iceHi:  new THREE.Color("#cfe6fb"),
    side:   new THREE.Color("#e9e3d6"),
    sideLo: new THREE.Color("#d8d0bf"),
    ink:    new THREE.Color("#1f232e"),
    blue:   new THREE.Color("#2d41d3"),
    hot:    new THREE.Color("#e8743b")
  };

  // ---------- Höhenmodell entpacken ----------
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const HQ = b64(T.h), MASK = b64(T.m);
  const NX = T.nx, NY = T.ny;
  const elev = (k) => HQ[k] / 255 * T.maxElev;

  // ===================================================================
  // Bühne: Renderer, Kamera, einfache Orbit-Steuerung, Render-Schleife
  // ===================================================================
  const stages = [];

  function createStage(container, opt = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(opt.fov || 32, 1, 0.1, 200);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc7b6, 1.7));
    const sun = new THREE.DirectionalLight(0xfff8ee, 3.2);
    sun.position.set(-6, 9, -4);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdbe9ff, 0.8);
    fill.position.set(6, 3, 8);
    scene.add(fill);

    const orbit = {
      target: new THREE.Vector3(...(opt.target || [0, 0.6, 0])),
      theta: opt.theta ?? -0.55, phi: opt.phi ?? 0.95, radius: opt.radius ?? 14,
      minR: opt.minR ?? 6, maxR: opt.maxR ?? 26, minPhi: 0.2, maxPhi: 1.45,
      autoRotate: opt.autoRotate || 0, vTheta: 0, vPhi: 0, interactive: !!opt.interactive
    };

    const st = { renderer, scene, camera, orbit, container, active: true, onFrame: null, dragging: false, moved: 0 };

    function place() {
      const o = orbit;
      o.phi = Math.max(o.minPhi, Math.min(o.maxPhi, o.phi));
      o.radius = Math.max(o.minR, Math.min(o.maxR, o.radius));
      camera.position.set(
        o.target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
        o.target.y + o.radius * Math.cos(o.phi),
        o.target.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta)
      );
      camera.lookAt(o.target);
    }
    st.place = place;

    if (orbit.interactive) {
      const el = renderer.domElement;
      let lx = 0, ly = 0;
      el.addEventListener("pointerdown", (e) => { st.dragging = true; st.moved = 0; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); el.classList.add("grabbing"); });
      el.addEventListener("pointermove", (e) => {
        if (!st.dragging) return;
        const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
        st.moved += Math.abs(dx) + Math.abs(dy);
        orbit.vTheta = -dx * 0.006; orbit.vPhi = -dy * 0.004;
        orbit.theta += orbit.vTheta; orbit.phi += orbit.vPhi;
      });
      const up = (e) => { st.dragging = false; el.classList.remove("grabbing"); try { el.releasePointerCapture(e.pointerId); } catch (_) {} };
      el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
      el.addEventListener("wheel", (e) => { e.preventDefault(); orbit.radius *= 1 + Math.sign(e.deltaY) * 0.08; }, { passive: false });
    }

    function resize() {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = w + "px";
      renderer.domElement.style.height = h + "px";
      camera.aspect = w / h;
      if (opt.shift) camera.setViewOffset(w, h, -w * opt.shift, 0, w, h); // Szene seitlich verschieben, ohne Drehpunkt zu ändern
      camera.updateProjectionMatrix();
    }
    st.resize = resize;
    new ResizeObserver(resize).observe(container);
    resize(); place();
    stages.push(st);
    return st;
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    stages.forEach((st) => {
      if (!st.active) return;
      const o = st.orbit;
      if (!st.dragging) {
        o.theta += o.vTheta; o.phi += o.vPhi;
        o.vTheta *= 0.92; o.vPhi *= 0.92;
        o.theta += o.autoRotate * dt;
      }
      st.place();
      if (st.onFrame) st.onFrame(dt);
      st.renderer.render(st.scene, st.camera);
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Weicher Schatten auf dem Boden
  function groundShadow(w, d, y) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const g = cv.getContext("2d");
    const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    grd.addColorStop(0, "rgba(60,50,30,0.22)"); grd.addColorStop(1, "rgba(60,50,30,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = y;
    return m;
  }

  // Glaskasten: feine Kanten + ganz leichte Flächen
  function glassBox(w, h, d, y0, opacity = 0.28) {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(0, y0 + h / 2, 0);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity })));
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.BackSide, depthWrite: false })));
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.08, depthWrite: false })));
    return g;
  }

  // ===================================================================
  // Relief-Diorama der Schweiz
  // ===================================================================
  const W = 10, DEP = W * (NY - 1) / (NX - 1), VSCALE = 1.25, BASE = -0.55;
  const lonToX = (lon) => (lon - T.lon0) / (T.lon1 - T.lon0) * W - W / 2;
  const latToZ = (lat) => (T.lat1 - lat) / (T.lat1 - T.lat0) * DEP - DEP / 2;
  const eToY = (e) => e / T.maxElev * VSCALE;

  function heightAt(lon, lat) {
    const fi = (lon - T.lon0) / (T.lon1 - T.lon0) * (NX - 1);
    const fj = (T.lat1 - lat) / (T.lat1 - T.lat0) * (NY - 1);
    const i = Math.max(0, Math.min(NX - 2, Math.floor(fi))), j = Math.max(0, Math.min(NY - 2, Math.floor(fj)));
    const u = fi - i, v = fj - j, k = j * NX + i;
    const e = elev(k) * (1 - u) * (1 - v) + elev(k + 1) * u * (1 - v) + elev(k + NX) * (1 - u) * v + elev(k + NX + 1) * u * v;
    return eToY(e);
  }

  function buildDiorama(opt = {}) {
    const group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(W, DEP, NX - 1, NY - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < NX * NY; k++) pos.setY(k, eToY(elev(k)));
    geo.computeVertexNormals();

    // Grundfarben
    const base = new Float32Array(NX * NY * 3);
    const tmp = new THREE.Color();
    for (let k = 0; k < NX * NY; k++) {
      const e = elev(k), m = MASK[k];
      if (m === 2) tmp.copy(C.lake);
      else if (m === 1) {
        const t = Math.min(1, Math.max(0, (e - 500) / 2400));
        tmp.copy(C.land).lerp(C.rock, t);
        if (e > 3000) tmp.lerp(C.high, Math.min(1, (e - 3000) / 900));
      } else {
        tmp.copy(C.out).lerp(C.outHi, Math.min(1, e / 3500));
      }
      base[k * 3] = tmp.r; base[k * 3 + 1] = tmp.g; base[k * 3 + 2] = tmp.b;
    }
    const col = new THREE.BufferAttribute(base.slice(), 3);
    geo.setAttribute("color", col);
    const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    group.add(terrain);

    // Seitenwände des Blocks (wie ein Schnitt durch die Erde)
    const sides = new THREE.Group();
    const edgeRuns = [
      [...Array(NX).keys()].map((i) => i),                              // Nord
      [...Array(NX).keys()].map((i) => (NY - 1) * NX + i),              // Süd
      [...Array(NY).keys()].map((j) => j * NX),                         // West
      [...Array(NY).keys()].map((j) => j * NX + NX - 1)                 // Ost
    ];
    edgeRuns.forEach((run) => {
      const v = [], c = [], idx = [];
      run.forEach((k, n) => {
        const x = pos.getX(k), z = pos.getZ(k), y = pos.getY(k);
        v.push(x, y, z, x, BASE, z);
        c.push(C.side.r, C.side.g, C.side.b, C.sideLo.r, C.sideLo.g, C.sideLo.b);
        if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      g.setIndex(idx);
      sides.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    });
    group.add(sides);
    // Bodenplatte
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(W, DEP), new THREE.MeshBasicMaterial({ color: C.sideLo }));
    bottom.rotation.x = Math.PI / 2; bottom.position.y = BASE; group.add(bottom);

    // Landesgrenze als feine Linie
    T.border.forEach((ring) => {
      const pts = ring.map(([lo, la]) => new THREE.Vector3(lonToX(lo), heightAt(lo, la) + 0.012, latToZ(la)));
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.55 })));
    });

    // Glaskasten um das Diorama
    if (opt.glass !== false) group.add(glassBox(W + 0.25, opt.glassH || 2.6, DEP + 0.25, BASE - 0.01, 0.22));
    group.add(groundShadow(W * 1.6, DEP * 1.9, BASE - 0.02));

    // ---- Gletscher: Eisflächen auf dem Relief, je nach Jahr ----
    const KM = W / ((T.lon1 - T.lon0) * 111 * Math.cos(46.8 * Math.PI / 180)); // Welt-Einheiten pro km
    const EXAG = opt.iceExag || 2.4; // Flächen sind im Landesmassstab winzig → vergrössert dargestellt
    const gl = D.glaciers.map((g) => {
      const x = lonToX(g.lon), z = latToZ(g.lat);
      const rMax = Math.sqrt(g.a1973 / Math.PI) * KM * EXAG * 1.15;
      const verts = [];
      const i0 = Math.round((x + W / 2) / W * (NX - 1)), j0 = Math.round((z + DEP / 2) / DEP * (NY - 1));
      const span = Math.ceil(rMax / (W / (NX - 1))) + 2;
      for (let j = Math.max(0, j0 - span); j <= Math.min(NY - 1, j0 + span); j++)
        for (let i = Math.max(0, i0 - span); i <= Math.min(NX - 1, i0 + span); i++) {
          const k = j * NX + i, d = Math.hypot(pos.getX(k) - x, pos.getZ(k) - z);
          if (d <= rMax && MASK[k] !== 2) verts.push([k, d, elev(k)]);
        }
      return { g, x, z, y: heightAt(g.lon, g.lat), verts };
    });
    const touched = new Set(); gl.forEach((o) => o.verts.forEach((v) => touched.add(v[0])));

    function setYear(year) {
      const ice = new Map();
      gl.forEach((o) => {
        const a = D.area(o.g, year);
        if (a <= 0) return;
        const r = Math.sqrt(a / Math.PI) * KM * EXAG;
        o.verts.forEach(([k, d, e]) => {
          // Eis liegt eher oben: unterhalb ~1800 m wird es dünner
          const alt = Math.min(1, Math.max(0.35, (e - 1500) / 1200));
          const f = Math.max(0, Math.min(1, (r - d) / (r * 0.35 + 0.02))) * alt;
          if (f > (ice.get(k) || 0)) ice.set(k, f);
        });
      });
      touched.forEach((k) => {
        const f = ice.get(k) || 0;
        tmp.setRGB(base[k * 3], base[k * 3 + 1], base[k * 3 + 2]);
        if (f > 0) { const iceC = C.ice.clone().lerp(C.iceHi, Math.min(1, elev(k) / 4200)); tmp.lerp(iceC, Math.min(1, f * 1.4)); }
        col.setXYZ(k, tmp.r, tmp.g, tmp.b);
      });
      col.needsUpdate = true;
    }

    return { group, setYear, glaciers: gl, W, DEP, BASE };
  }

  // ===================================================================
  // Eisblock im Glaswürfel – Oberfläche ist eine Berglandschaft aus Eis
  // ===================================================================
  const CUBE = 4, ICE_FOOT = 3.5, ICE_H = 2.55, ICE_RELIEF = 1.15;
  function iceLevelY(f) { return f * (ICE_H + ICE_RELIEF * 0.45); } // mittlere Höhe bei Anteil f

  function buildIceCube(opt = {}) {
    const group = new THREE.Group();
    const N = 56;
    // Ausschnitt aus dem Relief um den Aletsch-Gletscher als "Bergrücken"
    const ci = Math.round((8.0 - T.lon0) / (T.lon1 - T.lon0) * (NX - 1));
    const cj = Math.round((T.lat1 - 46.25) / (T.lat1 - T.lat0) * (NY - 1));
    const S = 70; // Zellen im Ausschnitt
    let mn = 1e9, mx = -1e9;
    const rel = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const ii = Math.min(NX - 1, Math.max(0, ci - S / 2 + Math.round(i / (N - 1) * S)));
      const jj = Math.min(NY - 1, Math.max(0, cj - S / 2 + Math.round(j / (N - 1) * S)));
      const e = elev(jj * NX + ii); rel.push(e); mn = Math.min(mn, e); mx = Math.max(mx, e);
    }
    const r01 = rel.map((e) => (e - mn) / (mx - mn));

    // geschlossener Körper: Oberfläche + Seiten + Boden
    const top = new THREE.PlaneGeometry(ICE_FOOT, ICE_FOOT, N - 1, N - 1);
    top.rotateX(-Math.PI / 2);
    const tp = top.attributes.position;
    for (let k = 0; k < N * N; k++) {
      // Rand leicht absenken, damit der Block wie geschnitten wirkt
      const i = k % N, j = Math.floor(k / N);
      const edge = Math.min(i, j, N - 1 - i, N - 1 - j) / 4;
      tp.setY(k, ICE_H + ICE_RELIEF * r01[k] * Math.min(1, 0.55 + edge));
    }
    top.computeVertexNormals();
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xcfe7fa, roughness: 0.28, metalness: 0.0, transparent: true, opacity: 0.88, flatShading: true, emissive: 0x2d6fb8, emissiveIntensity: 0.06 });
    const body = new THREE.Group();
    body.add(new THREE.Mesh(top, iceMat));

    const runs = [
      [...Array(N).keys()].map((i) => i),
      [...Array(N).keys()].map((i) => (N - 1) * N + i),
      [...Array(N).keys()].map((j) => j * N),
      [...Array(N).keys()].map((j) => j * N + N - 1)
    ];
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xb9dcf6, roughness: 0.2, transparent: true, opacity: 0.8, side: THREE.DoubleSide, emissive: 0x2d6fb8, emissiveIntensity: 0.05 });
    runs.forEach((run) => {
      const v = [], idx = [];
      run.forEach((k, n) => {
        v.push(tp.getX(k), tp.getY(k), tp.getZ(k), tp.getX(k), 0, tp.getZ(k));
        if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
      body.add(new THREE.Mesh(g, sideMat));
      // Oberkante als feine blaue Linie
      const line = new THREE.BufferGeometry().setFromPoints(run.map((k) => new THREE.Vector3(tp.getX(k), tp.getY(k) + 0.004, tp.getZ(k))));
      body.add(new THREE.Line(line, new THREE.LineBasicMaterial({ color: C.blue, transparent: true, opacity: 0.55 })));
    });
    // innere Schichten (dünne Linien auf den Seiten)
    for (let s = 1; s < 7; s++) {
      const y = ICE_H * s / 7, h = ICE_FOOT / 2 + 0.002;
      const pts = [[-h, y, -h], [h, y, -h], [h, y, h], [-h, y, h], [-h, y, -h]].map((p) => new THREE.Vector3(...p));
      body.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C.blue, transparent: true, opacity: 0.12 })));
    }
    group.add(body);

    // Schmelzwasser am Boden – wächst mit dem Verlust
    const water = new THREE.Mesh(new THREE.PlaneGeometry(CUBE - 0.02, CUBE - 0.02), new THREE.MeshBasicMaterial({ color: 0x9cc8ee, transparent: true, opacity: 0.0, depthWrite: false }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.01; group.add(water);

    group.add(glassBox(CUBE, CUBE, CUBE, 0, 0.32));
    group.add(groundShadow(CUBE * 2.2, CUBE * 2.2, -0.005));

    // Jahres-Ringe auf dem Glas (1970 gestrichelt, heisse Sommer orange, aktuelles Jahr blau)
    const rings = new THREE.Group(); group.add(rings);
    function ring(y, color, opacity, dashed) {
      const h = CUBE / 2 + 0.003;
      const pts = [[-h, y, -h], [h, y, -h], [h, y, h], [-h, y, h], [-h, y, -h]].map((p) => new THREE.Vector3(...p));
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = dashed
        ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.08, gapSize: 0.06 })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      const l = new THREE.Line(g, m); if (dashed) l.computeLineDistances();
      rings.add(l); return l;
    }

    let current = 1, target = 1;
    function setYear(year) {
      target = D.vol(year) / D.V0;
      rings.clear();
      ring(iceLevelY(1), C.ink, 0.5, true);
      if (opt.rings !== false) {
        for (let y = D.FIRST + 1; y < year; y++) if (D.hotSummers[y]) ring(iceLevelY(D.vol(y) / D.V0), C.hot, 0.7, false);
      }
      ring(iceLevelY(target), C.blue, 0.9, false);
    }
    function tick(dt) {
      current += (target - current) * Math.min(1, dt * 6);
      body.scale.y = current;
      water.material.opacity = Math.min(0.45, (1 - current) * 0.9);
    }
    return { group, setYear, tick, CUBE, levelY: iceLevelY };
  }

  return { createStage, buildDiorama, buildIceCube, lonToX, latToZ, heightAt, C };
})();
