/* =========================================================================
   3D-Kern (Three.js) – von allen Ansichten benutzt
   - createStage   : Renderer + Kamera + Maus-Steuerung + weiche Kamerafahrten
   - buildRelief   : Gelände-Ausschnitt (ganze Schweiz, Alpen-Band oder ein Gletscher)
   - buildIceCube  : Eisblock im Glaswürfel (alles Eis von 1970)
   - makeCore      : kleiner Zylinder = Eiskernbohrung
   - createLabels  : feine HTML-Beschriftungen mit Leitlinien, ohne Überlappung
   ========================================================================= */
window.Scene3D = (function () {
  const T = window.SWISS_TERRAIN, D = window.GLACIER_DATA;

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

  // ---------- Höhenmodell ----------
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const HQ = b64(T.h), MASK = b64(T.m);
  const NX = T.nx, NY = T.ny;
  const KX = 111 * Math.cos(46.8 * Math.PI / 180), KY = 111; // km pro Grad

  function elevAt(lon, lat) {
    const fi = Math.max(0, Math.min(NX - 1.001, (lon - T.lon0) / (T.lon1 - T.lon0) * (NX - 1)));
    const fj = Math.max(0, Math.min(NY - 1.001, (T.lat1 - lat) / (T.lat1 - T.lat0) * (NY - 1)));
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, k = j * NX + i;
    const e = (q) => HQ[q] / 255 * T.maxElev;
    return e(k) * (1 - u) * (1 - v) + e(k + 1) * u * (1 - v) + e(k + NX) * (1 - u) * v + e(k + NX + 1) * u * v;
  }
  function maskAt(lon, lat) {
    const i = Math.round((lon - T.lon0) / (T.lon1 - T.lon0) * (NX - 1));
    const j = Math.round((T.lat1 - lat) / (T.lat1 - T.lat0) * (NY - 1));
    if (i < 0 || j < 0 || i >= NX || j >= NY) return 0;
    return MASK[j * NX + i];
  }

  // ===================================================================
  // Bühne
  // ===================================================================
  const stages = [];
  const lerp = (a, b, t) => a + (b - a) * t;

  function createStage(container, opt = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(opt.fov || 30, 1, 0.05, 200);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc7b6, 1.7));
    const sun = new THREE.DirectionalLight(0xfff8ee, 3.2); sun.position.set(-6, 9, -4); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdbe9ff, 0.8); fill.position.set(6, 3, 8); scene.add(fill);

    const orbit = {
      target: new THREE.Vector3(...(opt.target || [0, 0.5, 0])),
      theta: opt.theta ?? 0, phi: opt.phi ?? 0.95, radius: opt.radius ?? 14,
      minR: opt.minR ?? 3, maxR: opt.maxR ?? 30, minPhi: 0.15, maxPhi: 1.5,
      autoRotate: 0, vTheta: 0, vPhi: 0
    };
    const st = { renderer, scene, camera, orbit, container, active: true, onFrame: null, dragging: false, moved: 0,
                 interactive: !!opt.interactive, shift: opt.shift || 0, goal: null, w: 1, h: 1 };

    function place() {
      const o = orbit;
      o.phi = Math.max(o.minPhi, Math.min(o.maxPhi, o.phi));
      o.radius = Math.max(o.minR, Math.min(o.maxR, o.radius));
      camera.position.set(
        o.target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
        o.target.y + o.radius * Math.cos(o.phi),
        o.target.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta));
      camera.lookAt(o.target);
    }
    function applyShift() {
      if (st.shift) camera.setViewOffset(st.w, st.h, -st.w * st.shift, 0, st.w, st.h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    function resize() {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      st.w = w; st.h = h;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px";
      camera.aspect = w / h; applyShift();
    }
    st.place = place; st.resize = resize; st.applyShift = applyShift;

    // Kamera weich an eine neue Position fahren
    st.flyTo = (g) => {
      if (g.theta != null) { // kürzesten Weg drehen
        let d = (orbit.theta - g.theta) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
        orbit.theta = g.theta + d;
      }
      st.goal = { ...g, target: g.target ? new THREE.Vector3(...g.target) : null };
    };

    const el = renderer.domElement;
    let lx = 0, ly = 0;
    el.addEventListener("pointerdown", (e) => {
      st.moved = 0;
      if (!st.interactive) return;
      st.dragging = true; st.goal = null; lx = e.clientX; ly = e.clientY;
      el.setPointerCapture(e.pointerId); el.classList.add("grabbing");
    });
    el.addEventListener("pointermove", (e) => {
      if (!st.dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      st.moved += Math.abs(dx) + Math.abs(dy);
      orbit.vTheta = -dx * 0.006; orbit.vPhi = -dy * 0.004;
      orbit.theta += orbit.vTheta; orbit.phi += orbit.vPhi;
    });
    const up = (e) => { st.dragging = false; el.classList.remove("grabbing"); try { el.releasePointerCapture(e.pointerId); } catch (_) {} };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", (e) => { if (!st.interactive) return; e.preventDefault(); st.goal = null; orbit.radius *= 1 + Math.sign(e.deltaY) * 0.08; }, { passive: false });

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
      if (st.goal) {
        const g = st.goal, t = Math.min(1, dt * 3.2);
        if (g.theta != null) o.theta = lerp(o.theta, g.theta, t);
        if (g.phi != null) o.phi = lerp(o.phi, g.phi, t);
        if (g.radius != null) o.radius = lerp(o.radius, g.radius, t);
        if (g.target) o.target.lerp(g.target, t);
        if (g.shift != null) { st.shift = lerp(st.shift, g.shift, t); st.applyShift(); }
      }
      if (!st.dragging) {
        o.theta += o.vTheta; o.phi += o.vPhi; o.vTheta *= 0.92; o.vPhi *= 0.92;
        o.theta += o.autoRotate * dt;
      }
      st.place();
      if (st.onFrame) st.onFrame(dt);
      st.renderer.render(st.scene, st.camera);
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- kleine Bausteine ----------
  function groundShadow(w, d, y, strength = 0.22) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const g = cv.getContext("2d");
    const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    grd.addColorStop(0, `rgba(60,50,30,${strength})`); grd.addColorStop(1, "rgba(60,50,30,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = y;
    return m;
  }

  function glassBox(w, h, d, y0, opacity = 0.28, tint = 0.18) {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, y0 + h / 2, 0);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity })));
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: tint, side: THREE.BackSide, depthWrite: false })));
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xeef6ff, transparent: true, opacity: tint * 0.45, depthWrite: false })));
    return g;
  }

  function ringLine(halfW, halfD, y, color, opacity, dashed) {
    const pts = [[-halfW, y, -halfD], [halfW, y, -halfD], [halfW, y, halfD], [-halfW, y, halfD], [-halfW, y, -halfD]].map((p) => new THREE.Vector3(...p));
    const m = dashed ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.08, gapSize: 0.06 })
                     : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m);
    if (dashed) l.computeLineDistances();
    return l;
  }

  // Eiskernbohrung: kleiner Zylinder mit Jahresringen
  function makeCore(h = 0.32, r = 0.05) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20, 1, false),
      new THREE.MeshStandardMaterial({ color: 0xe9f4fd, roughness: 0.25, transparent: true, opacity: 0.92, emissive: 0x2d41d3, emissiveIntensity: 0.04 }));
    body.position.y = h / 2; g.add(body);
    for (let i = 1; i <= 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, r * 0.08, 6, 24), new THREE.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.55 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = h * i / 4; g.add(ring);
    }
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: C.blue }));
    cap.rotation.x = -Math.PI / 2; cap.position.y = h + 0.001; g.add(cap);
    return g;
  }

  // ===================================================================
  // Relief: beliebiger Ausschnitt der Schweiz
  // opt: lon0, lon1, lat0, lat1, nx, width, vscale, floor, base, glass, glassH,
  //      iceExag, border, shadow, outsideFade
  // ===================================================================
  function buildRelief(opt = {}) {
    const lon0 = opt.lon0 ?? T.lon0, lon1 = opt.lon1 ?? T.lon1, lat0 = opt.lat0 ?? T.lat0, lat1 = opt.lat1 ?? T.lat1;
    const nx = opt.nx || NX;
    const kmW = (lon1 - lon0) * KX, kmD = (lat1 - lat0) * KY;
    const ny = Math.max(2, Math.round(nx * kmD / kmW));
    const W = opt.width || 10, DEP = W * kmD / kmW;
    const VS = opt.vscale || 1.25, FLOOR = opt.floor || 0, BASE = opt.base ?? -0.55;
    const KM = W / kmW;
    const lonToX = (lon) => (lon - lon0) / (lon1 - lon0) * W - W / 2;
    const latToZ = (lat) => (lat1 - lat) / (lat1 - lat0) * DEP - DEP / 2;
    const eToY = (e) => Math.max(0, e - FLOOR) / T.maxElev * VS;
    const heightAt = (lon, lat) => eToY(elevAt(lon, lat));

    const group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(W, DEP, nx - 1, ny - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const N = nx * ny, EL = new Float32Array(N), MK = new Uint8Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const lon = lon0 + (lon1 - lon0) * i / (nx - 1), lat = lat1 - (lat1 - lat0) * j / (ny - 1);
      EL[k] = elevAt(lon, lat); MK[k] = maskAt(lon, lat);
      pos.setY(k, eToY(EL[k]));
    }
    geo.computeVertexNormals();

    const base = new Float32Array(N * 3), tmp = new THREE.Color();
    for (let k = 0; k < N; k++) {
      const e = EL[k], m = MK[k];
      if (m === 2) tmp.copy(C.lake);
      else if (m === 1 || opt.outsideFade === false) {
        tmp.copy(C.land).lerp(C.rock, Math.min(1, Math.max(0, (e - 500) / 2400)));
        if (e > 3000) tmp.lerp(C.high, Math.min(1, (e - 3000) / 900));
      } else tmp.copy(C.out).lerp(C.outHi, Math.min(1, e / 3500));
      base[k * 3] = tmp.r; base[k * 3 + 1] = tmp.g; base[k * 3 + 2] = tmp.b;
    }
    const col = new THREE.BufferAttribute(base.slice(), 3);
    geo.setAttribute("color", col);
    const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: !!opt.transparent, opacity: 1 });
    group.add(new THREE.Mesh(geo, terrainMat));

    // Seitenwände
    const runs = [
      [...Array(nx).keys()].map((i) => i), [...Array(nx).keys()].map((i) => (ny - 1) * nx + i),
      [...Array(ny).keys()].map((j) => j * nx), [...Array(ny).keys()].map((j) => j * nx + nx - 1)];
    const sideMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: !!opt.transparent });
    runs.forEach((run) => {
      const v = [], c = [], idx = [];
      run.forEach((k, n) => {
        v.push(pos.getX(k), pos.getY(k), pos.getZ(k), pos.getX(k), BASE, pos.getZ(k));
        c.push(C.side.r, C.side.g, C.side.b, C.sideLo.r, C.sideLo.g, C.sideLo.b);
        if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3)); g.setIndex(idx);
      group.add(new THREE.Mesh(g, sideMat));
    });
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(W, DEP), new THREE.MeshBasicMaterial({ color: C.sideLo, transparent: !!opt.transparent }));
    bottom.rotation.x = Math.PI / 2; bottom.position.y = BASE; group.add(bottom);

    // Landesgrenze (nur Teile innerhalb des Ausschnitts)
    if (opt.border !== false) {
      const inside = (p) => p[0] >= lon0 && p[0] <= lon1 && p[1] >= lat0 && p[1] <= lat1;
      T.border.forEach((ring) => {
        let seg = [];
        const flush = () => {
          if (seg.length > 1) group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(seg),
            new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.5 })));
          seg = [];
        };
        ring.forEach((p) => { if (inside(p)) seg.push(new THREE.Vector3(lonToX(p[0]), heightAt(p[0], p[1]) + 0.012, latToZ(p[1]))); else flush(); });
        flush();
      });
    }
    // Höhenlinien (Marching Squares) – feine Topografie-Linien
    if (opt.contours) {
      const step = opt.contours, minor = [], major = [];
      let eMin = 1e9, eMax = -1e9; for (let k = 0; k < N; k++) { eMin = Math.min(eMin, EL[k]); eMax = Math.max(eMax, EL[k]); }
      const P = (k) => [pos.getX(k), pos.getZ(k)];
      for (let lv = Math.ceil(eMin / step) * step; lv < eMax; lv += step) {
        const out = lv % (step * 5) === 0 ? major : minor, y = eToY(lv) + 0.006;
        for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
          const k = [j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i];
          const e = k.map((q) => EL[q]);
          const pts = [];
          for (let a = 0; a < 4; a++) {
            const b = (a + 1) % 4;
            if ((e[a] < lv) !== (e[b] < lv)) {
              const t = (lv - e[a]) / (e[b] - e[a]), pa = P(k[a]), pb = P(k[b]);
              pts.push(pa[0] + (pb[0] - pa[0]) * t, y, pa[1] + (pb[1] - pa[1]) * t);
            }
          }
          if (pts.length === 6) out.push(...pts);
          else if (pts.length === 12) out.push(...pts);
        }
      }
      const mk = (arr, op) => { const g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
        return new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: op })); };
      group.add(mk(minor, 0.18), mk(major, 0.45));
    }

    if (opt.glass !== false) group.add(glassBox(W + 0.25, opt.glassH || 2.6, DEP + 0.25, BASE - 0.01, opt.glassOpacity ?? 0.22, opt.glassTint ?? 0.18));
    if (opt.shadow !== false) group.add(groundShadow(W * 1.6, DEP * 1.9, BASE - 0.02));

    // ---- Eisflächen ----
    const EXAG = opt.iceExag || 2.4;
    const margin = opt.glacierMargin ?? 0.15;
    const [aLo, aHi] = opt.iceAlt || [1500, 2700], aFloor = opt.iceAltFloor ?? 0.35;
    const gl = D.glaciers
      .filter((g) => g.lon > lon0 - margin && g.lon < lon1 + margin && g.lat > lat0 - margin && g.lat < lat1 + margin)
      .map((g) => {
        const x = lonToX(g.lon), z = latToZ(g.lat);
        const rMax = Math.sqrt(g.a1973 / Math.PI) * KM * EXAG * 1.15;
        const verts = [];
        const i0 = Math.round((x + W / 2) / W * (nx - 1)), j0 = Math.round((z + DEP / 2) / DEP * (ny - 1));
        const span = Math.ceil(rMax / (W / (nx - 1))) + 2;
        for (let j = Math.max(0, j0 - span); j <= Math.min(ny - 1, j0 + span); j++)
          for (let i = Math.max(0, i0 - span); i <= Math.min(nx - 1, i0 + span); i++) {
            const k = j * nx + i, d = Math.hypot(pos.getX(k) - x, pos.getZ(k) - z);
            if (d <= rMax && MK[k] !== 2) verts.push([k, d, EL[k]]);
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
          const alt = Math.min(1, Math.max(aFloor, (e - aLo) / (aHi - aLo)));
          const f = Math.max(0, Math.min(1, (r - d) / (r * 0.35 + 0.02))) * alt;
          if (f > (ice.get(k) || 0)) ice.set(k, f);
        });
      });
      touched.forEach((k) => {
        const f = ice.get(k) || 0;
        tmp.setRGB(base[k * 3], base[k * 3 + 1], base[k * 3 + 2]);
        if (f > 0) tmp.lerp(C.ice.clone().lerp(C.iceHi, Math.min(1, EL[k] / 4200)), Math.min(1, f * 1.4));
        col.setXYZ(k, tmp.r, tmp.g, tmp.b);
      });
      col.needsUpdate = true;
    }

    return { group, setYear, glaciers: gl, W, DEP, BASE, lonToX, latToZ, heightAt, terrainMat };
  }

  // ===================================================================
  // Eisblock im Glaswürfel
  // ===================================================================
  const CUBE = 4, ICE_FOOT = 3.5, ICE_H = 2.55, ICE_RELIEF = 1.15;
  const iceLevelY = (f) => f * (ICE_H + ICE_RELIEF * 0.45);

  function buildIceCube(opt = {}) {
    const group = new THREE.Group();
    // opt.lon/lat/span: welcher Relief-Ausschnitt die Eis-Oberfläche formt
    // opt.frac(year): Anteil des Eises von 1970 (Standard: alle Schweizer Gletscher)
    const N = 56, S = opt.span ?? 70;
    const frac = opt.frac || ((y) => D.vol(y) / D.V0);
    const ci = ((opt.lon ?? 8.0) - T.lon0) / (T.lon1 - T.lon0) * (NX - 1), cj = (T.lat1 - (opt.lat ?? 46.25)) / (T.lat1 - T.lat0) * (NY - 1);
    let mn = 1e9, mx = -1e9; const rel = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const lon = T.lon0 + (ci - S / 2 + i / (N - 1) * S) / (NX - 1) * (T.lon1 - T.lon0);
      const lat = T.lat1 - (cj - S / 2 + j / (N - 1) * S) / (NY - 1) * (T.lat1 - T.lat0);
      const e = elevAt(lon, lat); rel.push(e); mn = Math.min(mn, e); mx = Math.max(mx, e);
    }
    const top = new THREE.PlaneGeometry(ICE_FOOT, ICE_FOOT, N - 1, N - 1); top.rotateX(-Math.PI / 2);
    const tp = top.attributes.position;
    for (let k = 0; k < N * N; k++) {
      const i = k % N, j = Math.floor(k / N), edge = Math.min(i, j, N - 1 - i, N - 1 - j) / 4;
      tp.setY(k, ICE_H + ICE_RELIEF * (rel[k] - mn) / (mx - mn) * Math.min(1, 0.55 + edge));
    }
    top.computeVertexNormals();
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xcfe7fa, roughness: 0.28, transparent: true, opacity: 0.88, flatShading: true, emissive: 0x2d6fb8, emissiveIntensity: 0.06 });
    const body = new THREE.Group(); body.add(new THREE.Mesh(top, iceMat));
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xb9dcf6, roughness: 0.2, transparent: true, opacity: 0.8, side: THREE.DoubleSide, emissive: 0x2d6fb8, emissiveIntensity: 0.05 });
    const runs = [[...Array(N).keys()].map((i) => i), [...Array(N).keys()].map((i) => (N - 1) * N + i),
                  [...Array(N).keys()].map((j) => j * N), [...Array(N).keys()].map((j) => j * N + N - 1)];
    runs.forEach((run) => {
      const v = [], idx = [];
      run.forEach((k, n) => { v.push(tp.getX(k), tp.getY(k), tp.getZ(k), tp.getX(k), 0, tp.getZ(k)); if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
      body.add(new THREE.Mesh(g, sideMat));
    });
    group.add(body);
    group.add(glassBox(CUBE, CUBE, CUBE, 0, 0.32));
    group.add(groundShadow(CUBE * 2.2, CUBE * 2.2, -0.005));

    // ---- Jahres-Ebenen: für jedes Jahr die Eis-Oberfläche + ihr Zickzack-Rand ----
    // (teilen sich die Geometrie, nur in der Höhe skaliert → leicht)
    const loop = [];
    for (let i = 0; i < N; i++) loop.push(i);
    for (let j = 1; j < N; j++) loop.push(j * N + N - 1);
    for (let i = N - 2; i >= 0; i--) loop.push((N - 1) * N + i);
    for (let j = N - 2; j >= 0; j--) loop.push(j * N);
    const rimGeo = new THREE.BufferGeometry().setFromPoints(loop.map((k) => new THREE.Vector3(tp.getX(k), tp.getY(k), tp.getZ(k))));
    const layersG = new THREE.Group(); group.add(layersG);
    const COL = { line: new THREE.Color("#7fb8ec"), hot: C.hot, glow: new THREE.Color("#2d41d3"), face: new THREE.Color("#a9d1f5"), faceGlow: new THREE.Color("#4d6dff") };
    const layers = {};
    D.years.forEach((yr) => {
      const f = frac(yr), hot = !!D.hotSummers[yr], major = yr % 5 === 0;
      const face = new THREE.Mesh(top, new THREE.MeshBasicMaterial({ color: COL.face, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      face.scale.y = f; face.position.y = 0.006; face.renderOrder = 2;
      const rim = new THREE.Line(rimGeo, new THREE.LineBasicMaterial({ color: hot ? COL.hot : COL.line, transparent: true, opacity: 0.4 }));
      rim.scale.y = f; rim.position.y = 0.003; rim.renderOrder = 3;
      layersG.add(face, rim);
      layers[yr] = { yr, f, hot, major, face, rim };
    });

    let current = 1, target = 1, year = D.LAST, lit = new Set();
    function paint() {
      D.years.forEach((yr) => {
        const L = layers[yr], visible = yr <= year;
        L.face.visible = L.rim.visible = visible;
        if (!visible) return;
        const glow = lit.has(yr) || yr === year;
        L.face.material.color.copy(glow ? COL.faceGlow : COL.face);
        L.face.material.opacity = glow ? (yr === year ? 0.32 : 0.5) : 0;
        L.face.visible = visible && glow;
        L.rim.material.color.copy(glow ? COL.glow : L.hot ? COL.hot : COL.line);
        L.rim.material.opacity = glow ? 1 : L.hot ? 0.7 : L.major ? 0.45 : 0.16;
      });
    }
    function setYear(y) { year = y; target = frac(y); paint(); }
    function highlight(set) { lit = new Set(set); paint(); }
    function tick(dt) { current += (target - current) * Math.min(1, dt * 6); body.scale.y = current; }

    // Jahr zu einer Höhe am Glas (für Maus-Hover)
    function yearAtHeight(y) {
      let best = null, bd = 1e9;
      D.years.forEach((yr) => { if (yr > year) return; const d = Math.abs(iceLevelY(frac(yr)) - y); if (d < bd) { bd = d; best = yr; } });
      return bd < 0.12 ? best : null;
    }
    // Punkt auf dem Rand (rechts vorne) einer Jahres-Ebene – für Beschriftungen
    const cornerK = (N - 1) * N + N - 1, corners = [0, N - 1, N * N - 1, (N - 1) * N];
    const rimPoint = (yr) => new THREE.Vector3(tp.getX(cornerK), tp.getY(cornerK) * frac(yr), tp.getZ(cornerK));
    const rimCorners = (yr) => corners.map((k) => new THREE.Vector3(tp.getX(k), tp.getY(k) * frac(yr), tp.getZ(k)));

    // Gipfel für Gletscher-Markierungen (je Block der höchste Punkt)
    const peaks = [];
    for (let bj = 0; bj < 2; bj++) for (let bi = 0; bi < 3; bi++) {
      let bk = 0, bh = -1;
      for (let j = 6 + bj * 22; j < 6 + (bj + 1) * 22; j++) for (let i = 6 + bi * 15; i < 6 + (bi + 1) * 15; i++) {
        const k = j * N + i; if (tp.getY(k) > bh) { bh = tp.getY(k); bk = k; }
      }
      peaks.push(new THREE.Vector3(tp.getX(bk), tp.getY(bk), tp.getZ(bk)));
    }
    const surfaceAt = (p) => new THREE.Vector3(p.x, p.y * current, p.z);

    return { group, setYear, tick, highlight, yearAtHeight, rimPoint, rimCorners, peaks, surfaceAt, frac, CUBE, levelY: iceLevelY };
  }

  // ===================================================================
  // Feine Beschriftungen (HTML über dem Canvas)
  // items: { id, name, pos: () => THREE.Vector3 (Welt), val: () => string, gone: () => bool, small }
  // ===================================================================
  function createLabels(layer, stage, opt = {}) {
    const v3 = new THREE.Vector3();
    let items = [];
    const STEPS = Array.from({ length: opt.steps || 20 }, (_, i) => (opt.minLead || 22) + i * 16);

    function set(list) {
      layer.innerHTML = "";
      items = list.map((it) => {
        const el = document.createElement("div");
        el.className = "glabel" + (it.small ? " small" : "");
        el.innerHTML = `<div class="gl-text"><span class="gl-name">${it.name}</span><span class="gl-val"></span></div><div class="gl-line"></div><div class="gl-dot"></div>`;
        el.addEventListener("click", (e) => { e.stopPropagation(); opt.onClick && opt.onClick(it); });
        el.addEventListener("mouseenter", () => opt.onHover && opt.onHover(it, true));
        el.addEventListener("mouseleave", () => opt.onHover && opt.onHover(it, false));
        layer.appendChild(el);
        return { ...it, el, valEl: el.querySelector(".gl-val"), line: el.querySelector(".gl-line"), text: el.querySelector(".gl-text") };
      });
      refresh();
    }
    function refresh(selected) {
      items.forEach((it) => {
        const gone = it.gone ? it.gone() : false;
        it.el.classList.toggle("gone", gone);
        it.el.classList.toggle("is-selected", selected === it.id);
        it.valEl.textContent = it.val ? it.val() : "";
        it.bw = 0;
      });
    }
    function place(selected) {
      const w = stage.container.clientWidth, h = stage.container.clientHeight;
      const sr = stage.container.getBoundingClientRect();
      const placed = (opt.avoid || []).flatMap((q) => [...document.querySelectorAll(q)])
        .filter((e) => e && !e.hidden && e.offsetParent !== null && getComputedStyle(e).opacity > 0.1)
        .map((e) => { const r = e.getBoundingClientRect(); return { x0: r.left - sr.left - 6, x1: r.right - sr.left + 6, y0: r.top - sr.top - 6, y1: r.bottom - sr.top + 6, lx: -1, ly0: 0, ly1: 0 }; });
      items.slice().sort((a, b) => (b.rank || 0) - (a.rank || 0)).forEach((L) => {
        v3.copy(L.pos()).project(stage.camera);
        const x = (v3.x * 0.5 + 0.5) * w, y = (-v3.y * 0.5 + 0.5) * h;
        if (v3.z > 1 || x < -50 || x > w + 50) { L.el.style.display = "none"; return; }
        L.el.style.display = "";
        if (!L.bw) { L.bw = L.text.offsetWidth + 4; L.bh = L.text.offsetHeight + 2; }
        let chosen = null;
        for (const len of STEPS) {
          for (const side of [1, -1]) {
            const box = side > 0 ? { x0: x - 2, x1: x + L.bw, y0: y - len - L.bh, y1: y - len }
                                 : { x0: x - L.bw, x1: x + 2, y0: y - len - L.bh, y1: y - len };
            const hit = placed.some((p) => (box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0) ||
                                           (p.lx > box.x0 && p.lx < box.x1 && p.ly0 < box.y1 && p.ly1 > box.y0));
            if (!hit && box.x0 > 4 && box.y0 > 4 && box.x1 < w - 4) { chosen = { ...box, len, side }; break; }
          }
          if (chosen) break;
        }
        const show = !!chosen || selected === L.id;
        if (!chosen) chosen = { len: STEPS[1], side: 1, x0: x, x1: x, y0: y, y1: y };
        placed.push({ ...chosen, lx: x, ly0: y - chosen.len, ly1: y });
        L.line.style.height = chosen.len + "px";
        L.el.classList.toggle("left", chosen.side < 0);
        L.el.classList.toggle("collapsed", !show);
        L.el.style.zIndex = show ? 100 + Math.round(y) : 1;
        L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${chosen.side < 0 ? "-100%" : "0"}, calc(-100% + 2.5px))`;
      });
    }
    return { set, refresh, place, clear: () => { layer.innerHTML = ""; items = []; } };
  }

  return { createStage, buildRelief, buildIceCube, makeCore, glassBox, ringLine, groundShadow, createLabels, elevAt, C, KX, KY };
})();
