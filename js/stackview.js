/* =========================================================================
   Startseite: EIN Block – Karte und Cube verbunden
   Ein rechteckiger Glas-Block der ganzen Schweiz, in Ebenen auseinandergezogen:
     01 Karte      – Relief, Seen, Grenze, Eis im gewählten Jahr, Gletscher anklickbar
     02 Eisfläche  – wo 1973 Eis lag und wo heute noch (SGI 1973 / 2016 / 2023)
     03 Höhe       – Höhenstufen des Geländes
     04 Eisvolumen – der Cube: Eisblock, so hoch wie das Volumen; jede Linie ein Jahr
   Gestrichelte Linien an den Ecken verbinden die Ebenen, rechts die Beschriftung.
   Die Zeitleiste wechselt das Jahr auf allen Ebenen.
   ========================================================================= */
window.StackView = (function () {
  const D = GLACIER_DATA;
  const GAP = 2.45, HV = 1.55, NX = 190;
  let stage, root, plates = [], labels, glLabels, vol, hoverPlate = -1, built = false;
  const v3 = new THREE.Vector3();
  const C = () => Scene3D.C;

  const CAM = { theta: 0.6, phi: 1.17, radius: 52, target: [0, 4.1, 0], shift: 0.05 };

  // ---------------- Ebenen ----------------
  function relief(extra = {}) {
    return Scene3D.buildRelief({ nx: NX, width: 10, vscale: 0.62, base: -0.16, glass: false, shadow: false, ...extra });
  }

  function paint(r, fn) {
    const c = new THREE.Color();
    for (let k = 0; k < r.EL.length; k++) {
      fn(k, c);
      r.col.setXYZ(k, c.r, c.g, c.b);
    }
    r.col.needsUpdate = true;
  }

  const outside = (r, k) => r.MK[k] !== 1;
  const fadeOut = (r, k, c) => { if (outside(r, k)) c.lerp(new THREE.Color("#e6e8eb"), r.MK[k] === 2 ? 0.2 : 0.75); };

  function buildPlates() {
    const P = [];
    // 01 Karte
    const map = relief({ border: true, nx: 260 });
    P.push({ r: map, key: "map", num: "01", title: "Map",
      text: () => `Relief of Switzerland with all glacier ice in ${App.state.year}. Pick a glacier to open it.`,
      legend: `<span class="lg-sw" style="background:#8fbfe8"></span>Glacier ice <span class="lg-sw lake"></span>Lakes`,
      update: (y) => map.setYear(y) });

    // 02 Eisfläche: 1973 vs Jahr
    const ext = relief({});
    const f73 = ext.field.at(1973);
    const grey = new THREE.Color("#eceef1"), lost = new THREE.Color("#b9c2d6"), now = new THREE.Color("#2e48cf");
    P.push({ r: ext, key: "extent", num: "02", title: "Ice extent",
      text: () => `Blue: ice in ${App.state.year}. Grey-blue: ice that was there in 1973 and is gone.`,
      legend: () => `<span class="lg-sw" style="background:#2e48cf"></span>Ice ${App.state.year} <span class="lg-sw" style="background:#b9c2d6"></span>Lost since 1973`,
      update: (y) => {
        const f = ext.field.at(y);
        paint(ext, (k, c) => {
          const shade = 0.93 + (ext.Y(k) / 0.62) * 0.05;
          c.copy(grey).multiplyScalar(shade);
          if (ext.MK[k] === 2) c.set("#dfe6ee");
          const a = Math.min(1, f73[k] * 1.6), b = Math.min(1, f[k] * 1.6);
          if (a > 0.02) c.lerp(lost, Math.min(1, a * 1.3));
          if (b > 0.02) c.lerp(now, Math.min(1, b * 1.1));
          fadeOut(ext, k, c);
        });
      } });

    // 03 Höhe
    const el = relief({});
    const ramp = [[300, "#f3f4f6"], [1000, "#e1e3e7"], [1800, "#c4c8cf"], [2600, "#9ca2ac"], [3400, "#6d7480"], [4600, "#3a404a"]].map(([e, h]) => [e, new THREE.Color(h)]);
    paint(el, (k, c) => {
      const e = el.EL[k];
      let i = 0; while (i < ramp.length - 2 && e > ramp[i + 1][0]) i++;
      const t = Math.max(0, Math.min(1, (e - ramp[i][0]) / (ramp[i + 1][0] - ramp[i][0])));
      c.copy(ramp[i][1]).lerp(ramp[i + 1][1], t);
      if (el.MK[k] === 2) c.set("#dfe6ee");
      fadeOut(el, k, c);
    });
    P.push({ r: el, key: "elev", num: "03", title: "Elevation",
      text: () => "Glaciers live high up: almost all Swiss ice lies above 2500 m.",
      legend: `<span class="lg-bar" style="background:linear-gradient(90deg,#f3f4f6,#c4c8cf,#6d7480,#3a404a)"></span><span class="lg-ends"><span>300 m</span><span>4600 m</span></span>`,
      update: () => {} });

    // 04 Eisvolumen (der Cube)
    vol = buildVolume(map.W, map.DEP);
    P.push({ r: { group: vol.group, W: map.W, DEP: map.DEP }, key: "volume", num: "04", title: "Ice volume", isVol: true,
      text: () => { const y = App.state.year, v = D.vol(y); return `${App.fmt(v)} km³ in ${y}${y === D.PROVISIONAL ? " (provisional)" : ""}: ${App.fmt(v / D.V0 * 100, 0)}% of 1970. The lines above mark the ice surface of every earlier year.`; },
      legend: `<span class="lg-sw" style="background:#cfe3f7;border:1px solid #8fbfe8"></span>Ice left <span class="lg-sw line"></span>Ice surface in earlier years`,
      update: (y) => vol.setYear(y) });
    return P;
  }

  // Der Eisblock: Höhe = Volumen, Jahreslinien rundherum
  function buildVolume(W, DEP) {
    const g = new THREE.Group();
    const hw = W / 2, hd = DEP / 2, ink = C().ink, blue = C().blue;
    // Sockel-Platte + Glas
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, DEP), new THREE.MeshLambertMaterial({ color: 0xe4e6ea }));
    base.position.y = -0.06; g.add(base);
    g.add(Scene3D.glassBox(W, HV + 0.1, DEP, 0, 0.35, 0.08));
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xcfe3f7, roughness: 0.35, transparent: true, opacity: 0.82, emissive: 0x2e48cf, emissiveIntensity: 0.05 });
    const ice = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 1, DEP - 0.02), iceMat);
    g.add(ice);
    const top = Scene3D.ringLine(hw, hd, 0, blue, 1); g.add(top);
    const lvl = (y) => D.vol(y) / D.V0 * HV;
    const rings = D.years.map((y) => {
      const major = y % 5 === 0;
      const l = Scene3D.ringLine(hw + 0.004, hd + 0.004, lvl(y), ink, major ? 0.3 : 0.07);
      l.userData.year = y; g.add(l);
      const d = Scene3D.ringLine(hw + 0.004, hd + 0.004, lvl(y), ink, 0.22, true);
      d.visible = false; g.add(d);
      return { y, l, d, major };
    });
    function setYear(year) {
      const h = Math.max(0.01, lvl(year));
      ice.scale.y = h; ice.position.y = h / 2;
      top.position.y = h + 0.004;
      rings.forEach((r) => {
        const past = r.y <= year;
        r.l.visible = past && r.y !== year;
        r.d.visible = !past && r.major;
      });
    }
    return { group: g, ice, setYear, lvl, yearAt: (yLocal) => {
      let best = null, bd = 1e9;
      D.years.forEach((y) => { const d = Math.abs(lvl(y) - yLocal); if (d < bd) { bd = d; best = y; } });
      return best;
    } };
  }

  // ---------------- Aufbau ----------------
  function build() {
    plates = buildPlates();
    const n = plates.length;
    plates.forEach((p, i) => {
      p.y = (n - 1 - i) * GAP + (p.isVol ? 0 : HV - GAP + 0.55 + (n - 2 - i) * 0);
      p.r.group.position.y = p.y;
      root.add(p.r.group);
      // Rahmen um jede Ebene (leuchtet beim Darüberfahren)
      const hw = p.r.W / 2 + 0.02, hd = p.r.DEP / 2 + 0.02;
      p.ring = Scene3D.ringLine(hw, hd, p.isVol ? 0 : -0.16, C().ink, 0.0);
      p.r.group.add(p.ring);
    });
    // Abstand: Volumen unten, darüber gleichmässig die Karten-Ebenen
    const top0 = HV + 1.7;
    plates.filter((p) => !p.isVol).forEach((p, i, arr) => { p.y = top0 + (arr.length - 1 - i) * GAP; p.r.group.position.y = p.y; });
    plates.find((p) => p.isVol).y = 0;

    // gestrichelte Verbindungen an den Ecken
    const W = plates[0].r.W, DEP = plates[0].r.DEP, yTop = plates[0].y + 0.3;
    const pts = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => pts.push(new THREE.Vector3(sx * W / 2, 0, sz * DEP / 2), new THREE.Vector3(sx * W / 2, yTop, sz * DEP / 2)));
    const lg = new THREE.BufferGeometry().setFromPoints(pts);
    const lines = new THREE.LineSegments(lg, new THREE.LineDashedMaterial({ color: C().ink, transparent: true, opacity: 0.35, dashSize: 0.07, gapSize: 0.09 }));
    lines.computeLineDistances(); root.add(lines);

    // Beschriftung rechts
    labels.innerHTML = plates.map((p, i) => `
      <div class="sk-label" data-i="${i}">
        <span class="sk-num">${p.num}</span>
        <div class="sk-body"><b class="sk-title">${p.title}</b><p class="sk-text"></p><div class="sk-legend"></div></div>
      </div>`).join("") + `<svg class="sk-lines"></svg>`;
    plates.forEach((p, i) => { p.el = labels.querySelector(`.sk-label[data-i="${i}"]`); p.el.addEventListener("mouseenter", () => setHover(i)); p.el.addEventListener("mouseleave", () => setHover(-1)); });

    // Gletscher-Beschriftung auf der Karten-Ebene
    const map = plates[0];
    glLabels = Scene3D.createLabels(App.$("stack-glabels"), stage, {
      avoid: [".sk-label", ".view-head", ".home-text"], minLead: 18, steps: 10,
      onClick: (it) => App.openGlacier(it.id)
    });
    glLabels.set(D.glaciers.filter((g) => g.a1973 > 5.5).map((g) => ({
      id: g.id, name: g.name, rank: g.a1973, small: g.a1973 < 15,
      pos: () => new THREE.Vector3(map.r.lonToX(g.lon), map.r.heightAt(g.lon, g.lat) + map.y + 0.02, map.r.latToZ(g.lat)),
      val: () => { const a = D.area(g, App.state.year); return a > 0 ? App.fmt(a) + " km²" : "gone"; }
    })));
    built = true;
    update(App.state.year);
  }

  function update(y) {
    plates.forEach((p) => p.update(y));
    plates.forEach((p) => { p.el.querySelector(".sk-text").textContent = p.text(); p.el.querySelector(".sk-legend").innerHTML = typeof p.legend === "function" ? p.legend() : p.legend; });
    if (glLabels) glLabels.refresh();
  }

  function setHover(i) {
    hoverPlate = i;
    plates.forEach((p, j) => {
      p.el.classList.toggle("on", j === i);
      p.ring.material.opacity = j === i ? 0.9 : 0;
      p.ring.material.color.copy(j === i ? C().blue : C().ink);
    });
  }

  // Beschriftung rechts an die Ebenen heften
  function placeLabels() {
    const w = stage.container.clientWidth, h = stage.container.clientHeight;
    const svg = labels.querySelector(".sk-lines");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const colX = w - 236;
    let out = "", lastBottom = -1e9;
    plates.forEach((p) => {
      // rechteste Ecke der Ebene auf dem Bildschirm
      let best = null;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
        v3.set(sx * p.r.W / 2, p.y + (p.isVol ? HV * 0.5 : 0), sz * p.r.DEP / 2).project(stage.camera);
        const x = (v3.x * 0.5 + 0.5) * w, y = (-v3.y * 0.5 + 0.5) * h;
        if (!best || x > best.x) best = { x, y };
      });
      const lh = p.el.offsetHeight || 80;
      let top = Math.max(best.y - 14, lastBottom + 14);
      p.el.style.transform = `translate(${colX}px, ${top}px)`;
      lastBottom = top + lh;
      const ly = top + 9;
      out += `<path d="M${best.x + 6},${best.y} L${colX - 34},${best.y} L${colX - 14},${ly}" class="${p.el.classList.contains("on") ? "on" : ""}"/><circle cx="${best.x + 3}" cy="${best.y}" r="2.2"/>`;
    });
    svg.innerHTML = out;
  }

  // ---------------- Maus ----------------
  function bindPointer() {
    const ray = new THREE.Raycaster(), m = new THREE.Vector2(), el = stage.renderer.domElement;
    const pick = (e) => {
      const r = el.getBoundingClientRect();
      m.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(m, stage.camera);
      for (let i = 0; i < plates.length; i++) {
        const hit = ray.intersectObject(plates[i].r.group, true)[0];
        if (hit) return { i, hit };
      }
      return null;
    };
    el.addEventListener("pointermove", (e) => {
      if (stage.dragging) return;
      const p = pick(e);
      setHover(p ? p.i : -1);
      el.style.cursor = p ? "pointer" : "";
      if (p && plates[p.i].isVol) {
        const yr = vol.yearAt(p.hit.point.y - plates[p.i].y);
        App.showTip(`<b>${yr}</b>, ${App.fmt(D.vol(yr))} km³ (${App.fmt(D.vol(yr) / D.V0 * 100, 0)}%)<br><span class="t-dim">Click to show this year</span>`, e);
      } else App.hideTip();
    });
    el.addEventListener("pointerleave", () => { setHover(-1); App.hideTip(); });
    el.addEventListener("click", (e) => {
      if (stage.moved > 6) return;
      const p = pick(e);
      if (!p) return;
      if (plates[p.i].isVol) { Timeline.stop(); App.setYear(vol.yearAt(p.hit.point.y - plates[p.i].y)); }
      else if (plates[p.i].key === "map") {
        // nächster Gletscher zur Klickstelle
        const map = plates[p.i].r, x = p.hit.point.x, z = p.hit.point.z;
        let best = null, bd = 1e9;
        D.glaciers.forEach((g) => { const d = Math.hypot(map.lonToX(g.lon) - x, map.latToZ(g.lat) - z); if (d < bd) { bd = d; best = g; } });
        if (best && bd < 0.45) App.openGlacier(best.id);
      }
    });
  }

  function onRoute(s) {
    const on = s.mode === "overview";
    stage.active = on;
    if (on && !built) build();
    if (on) { stage.resize(); }
  }

  function init() {
    const box = App.$("stack-stage");
    labels = App.$("stack-labels");
    stage = Scene3D.createStage(box, { fov: 17, ...CAM, interactive: true, minR: 30, maxR: 70 });
    stage.orbit.minPhi = 0.7; stage.orbit.maxPhi = 1.3;
    root = new THREE.Group(); stage.scene.add(root);
    stage.onFrame = () => { if (built) { placeLabels(); glLabels.place(); } };
    bindPointer();
    App.onChange((s, what) => {
      if (what === "route") onRoute(s);
      else if (what === "year" && built) update(s.year);
    });
    onRoute(App.state);
  }

  return { init };
})();
