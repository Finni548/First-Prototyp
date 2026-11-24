/* =========================================================================
   App – gemeinsamer Zustand
   page : "home" (Karte + Cube) oder "map" (Karte gross)
   mode : auf der Startseite "overview" → "cube" → "glacier"
   ========================================================================= */
window.App = (function () {
  const D = window.GLACIER_DATA;
  const state = { year: D.LAST, page: "home", mode: "overview", glacier: null };
  const listeners = [];

  const fmt = (n, d = 1) => n.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
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

  // Route: "home" | "cube" | "glacier/<id>" | "map"
  function go(route) {
    const [r, id] = (route || "home").split("/");
    if (r === "map") { state.page = "map"; }
    else {
      state.page = "home";
      state.mode = r === "cube" ? "cube" : r === "glacier" && glacierById(id) ? "glacier" : "overview";
      state.glacier = state.mode === "glacier" ? id : null;
    }
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("is-active", p.id === "page-" + state.page));
    document.body.classList.toggle("detail", state.page === "map" || state.mode !== "overview");
    document.body.classList.toggle("on-map", state.page === "map");
    const navKey = state.page === "map" ? "map" : state.mode === "overview" ? "home" : "cube";
    document.querySelectorAll(".main-nav a").forEach((a) => a.classList.toggle("is-active", a.dataset.go === navKey));
    history.replaceState(null, "", "#" + (state.page === "map" ? "map" : state.mode === "glacier" ? "glacier/" + state.glacier : state.mode === "cube" ? "cube" : "home"));
    emit("route");
  }
  const openGlacier = (id) => go("glacier/" + id);

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
    const g = state.mode === "glacier" && state.page === "home" ? glacierById(state.glacier) : null;
    if (g) {
      const a = D.area(g, y), a0 = D.area(g, D.FIRST), prev = y > D.FIRST ? D.area(g, y - 1) : a;
      $("info-kicker").innerHTML = `${g.name} · <b id="info-year">${y}</b>`;
      $("hero-vol").textContent = a > 0 ? fmt(a) : "0";
      $("hero-unit").textContent = "km²";
      $("hero-bar").style.width = (a / a0 * 100) + "%";
      $("hero-sub").innerHTML = a > 0 ? `<span>${fmt(a / a0 * 100, 0)} %</span> der Fläche von 1970` : g.goneText;
      $("loss-total").textContent = signed(a - a0) + " km²";
      $("loss-biel").textContent = "Fläche (Näherung)";
      $("loss-year").textContent = y === D.FIRST ? "Start" : signed(a - prev, 2) + " km²";
      $("loss-year-pct").textContent = "Kanton " + g.canton;
    } else {
      const v = D.vol(y), pct = v / D.V0 * 100, lost = v - D.V0;
      $("info-kicker").innerHTML = `Gletschereis Schweiz · <b id="info-year">${y}</b>`;
      $("hero-vol").textContent = fmt(v);
      $("hero-unit").textContent = "km³";
      $("hero-bar").style.width = pct + "%";
      $("hero-sub").innerHTML = `<span>${fmt(pct, 0)} %</span> vom Eis von 1970 ist noch da`;
      $("loss-total").textContent = signed(lost) + " km³";
      $("loss-biel").textContent = lost < -0.5 ? "≈ " + fmt(Math.abs(lost) / D.BIELERSEE, 0) + " × Bielersee" : "kaum Veränderung";
      $("loss-year").textContent = y === D.FIRST ? "Start" : signed(D.change(y)) + " km³";
      $("loss-year-pct").textContent = y === D.FIRST ? "1970 = 100 %" : signed(D.changePct(y)) + " %";
    }
    const hot = D.hotSummers[y], ev = D.events.find((e) => e.year === y);
    const note = $("year-note");
    note.textContent = hot ? "Heisser Sommer · " + hot : ev ? ev.label : "";
    note.classList.toggle("hot", !!hot);
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", +c.dataset.year === y));

    const v = D.vol(y);
    $("st-pct").textContent = signed(v / D.V0 * 100 - 100, 0) + " %";
    $("st-vol").textContent = fmt(v) + " km³";
    document.querySelectorAll(".yr").forEach((e) => (e.textContent = y));
  }

  function buildChips() {
    Object.keys(D.hotSummers).forEach((y) => {
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = y; b.dataset.year = y; b.title = D.hotSummers[y];
      b.addEventListener("click", () => { Timeline.stop(); setYear(+y); });
      $("hot-chips").appendChild(b);
    });
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
    buildChips(); buildSearch();
    document.querySelectorAll("[data-go]").forEach((el) =>
      el.addEventListener("click", (e) => { e.preventDefault(); go(el.dataset.go); }));
    onChange(renderInfo);

    Timeline.init();
    Home.init();
    CubeView.init();
    MapView.init();

    go(location.hash.replace("#", "") || "home");
  }

  return { state, D, setYear, go, openGlacier, glacierById, onChange, emit, start, fmt, signed, $, showTip, hideTip };
})();
