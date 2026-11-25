/* =========================================================================
   App – gemeinsamer Zustand
   page : "home" (Karte + Cube) oder "map" (Karte gross)
   mode : auf der Startseite "overview" → "cube" → "glacier"
   ========================================================================= */
window.App = (function () {
  const D = window.GLACIER_DATA;
  const state = { year: D.LAST, page: "home", mode: "overview", glacier: null, core: null };
  const listeners = [];

  const fmt = (n, d = 1) => n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  const signed = (n, d = 1) => (n > 0 ? "+" : n < 0 ? "−" : "±") + fmt(Math.abs(n), d);
  const $ = (id) => document.getElementById(id);
  const glacierById = (id) => D.glaciers.find((g) => g.id === id);

  function onChange(fn) { listeners.push(fn); }
  function emit(what = "year") { listeners.forEach((fn) => fn(state, what)); }

  function setYear(y) {
    y = Math.max(D.FIRST, Math.min(D.LAST, Math.round(y)));
    if (y === state.year) return;
    state.year = y; emit("year");
  }

  // Routen
  //   Cube-Weg : "home" → "cube" → "glacier/<id>"
  //   Karten-Weg: "map" → "area/<id>" → "probe/<id>/<kern>"
  const MODES = ["overview", "cube", "glacier", "map", "area", "probe"];
  function go(route) {
    const [r, id, core] = (route || "home").split("/");
    let mode = r === "home" ? "overview" : r;
    if (!MODES.includes(mode)) mode = "overview";
    if (["glacier", "area", "probe"].includes(mode) && !glacierById(id)) mode = "overview";
    state.page = "home";
    state.mode = mode;
    state.glacier = ["glacier", "area", "probe"].includes(mode) ? id : null;
    state.core = mode === "probe" ? (core || "k1") : null;
    document.body.classList.toggle("detail", mode !== "overview");
    document.body.classList.toggle("glacier-mode", mode === "glacier" || mode === "probe");
    const navKey = ["map", "area", "probe"].includes(mode) ? "map" : mode === "overview" ? "home" : "cube";
    document.querySelectorAll(".main-nav a").forEach((a) => a.classList.toggle("is-active", a.dataset.go === navKey));
    const hash = mode === "overview" ? "home" : mode === "probe" ? `probe/${id}/${state.core}` : state.glacier ? `${mode}/${id}` : mode;
    history.replaceState(null, "", "#" + hash);
    emit("route");
  }
  const openGlacier = (id) => go("glacier/" + id);
  const openProbe = (id, core) => go(`probe/${id}/${core}`);

  // ---------- Tooltip ----------
  function showTip(html, evt) {
    const t = $("tooltip"), box = document.querySelector(".content").getBoundingClientRect();
    t.innerHTML = html;
    t.style.left = evt.clientX - box.left + "px"; t.style.top = evt.clientY - box.top + "px";
    t.classList.add("show");
  }
  function hideTip() { $("tooltip").classList.remove("show"); }

  // ---------- Zahlen-Karte ----------
  function renderInfo() {
    const y = state.year;
    const g = ["glacier", "area", "probe"].includes(state.mode) ? glacierById(state.glacier) : null;
    if (g) {
      const a = D.area(g, y), a0 = D.area(g, D.FIRST), prev = y > D.FIRST ? D.area(g, y - 1) : a;
      $("info-kicker").textContent = `${g.name}, area ${y}`;
      $("hero-vol").textContent = a > 0 ? fmt(a) : "0";
      $("hero-unit").textContent = "km²";
      $("hero-bar").style.width = (a / a0 * 100) + "%";
      $("hero-sub").textContent = a > 0 ? `${fmt(a / a0 * 100, 0)}% of the 1970 area left (between the inventories 1973, 2016 and 2023 interpolated).` : g.goneText + ".";
      $("loss-total").textContent = signed(a - a0) + " km²";
      $("loss-year").textContent = y === D.FIRST ? "First year" : signed(a - prev, 2) + " km²";
    } else {
      const v = D.vol(y), pct = v / D.V0 * 100, lost = v - D.V0;
      $("info-kicker").textContent = `Swiss glacier ice, ${y}`;
      $("hero-vol").textContent = fmt(v);
      $("hero-unit").textContent = "km³";
      $("hero-bar").style.width = pct + "%";
      $("hero-sub").textContent = lost < -0.5
        ? `${fmt(pct, 0)}% of the 1970 ice is left. The loss equals ${fmt(Math.abs(lost) / D.BIELERSEE, 0)} times the volume of Lake Biel.`
        : `${fmt(pct, 0)}% of the 1970 ice is left.`;
      $("loss-total").textContent = signed(lost) + " km³";
      $("loss-year").textContent = y === D.FIRST ? "First year" : `${signed(D.change(y))} km³ (${signed(D.changePct(y))}%)`;
    }
    const L = g ? D.lengthChange(g, y) : null;
    $("row-len").hidden = L == null;
    if (L != null) $("loss-len").textContent = L === 0 ? "0 m" : `${signed(L, 0)} m${y > g.length.to ? " (until " + g.length.to + ")" : ""}`;
    const hot = D.hotSummers[y], ev = D.events.find((e) => e.year === y);
    const note = $("year-note");
    note.textContent = hot ? "Hot summer: " + hot : ev ? ev.label : "";
    note.classList.toggle("hot", !!hot);

    const v = D.vol(y);
    $("st-gone").textContent = D.vanished.count + " glaciers";
    $("st-pct").textContent = signed(v / D.V0 * 100 - 100, 0) + "%";
    $("st-vol").textContent = fmt(v) + " km³";
    document.querySelectorAll(".yr").forEach((e) => (e.textContent = y));
  }

  function buildSearch() {
    const list = $("glacier-list");
    D.glaciers.forEach((g) => { const o = document.createElement("option"); o.value = g.name; list.appendChild(o); });
    const find = (q) => {
      q = q.trim().toLowerCase(); if (!q) return null;
      return D.glaciers.find((g) => g.name.toLowerCase() === q) || D.glaciers.find((g) => g.name.toLowerCase().includes(q));
    };
    $("search").addEventListener("submit", (e) => {
      e.preventDefault();
      const g = find($("search-input").value);
      if (g) { openGlacier(g.id); $("search-input").value = ""; $("search-input").blur(); }
      else $("search").classList.add("nohit"), setTimeout(() => $("search").classList.remove("nohit"), 900);
    });
    $("search-input").addEventListener("change", () => { const g = D.glaciers.find((x) => x.name === $("search-input").value); if (g) $("search").requestSubmit(); });
  }

  function start() {
    buildSearch();
    document.querySelectorAll("[data-go]").forEach((el) =>
      el.addEventListener("click", (e) => { e.preventDefault(); go(el.dataset.go); }));
    onChange(renderInfo);

    Timeline.init();
    Home.init();
    GlacierView.init();
    CubeView.init();
    MapView.init();
    StackView.init();
    Probe.init();

    go(location.hash.replace("#", "") || "home");
  }

  return { state, D, setYear, go, openGlacier, openProbe, glacierById, onChange, emit, start, fmt, signed, $, showTip, hideTip };
})();
