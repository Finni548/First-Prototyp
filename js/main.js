/* =========================================================================
   App – gemeinsamer Zustand: Jahr, Seite (Übersicht / Karte / Eisblock),
   ausgewählter Gletscher. Alle Ansichten hören auf App.onChange.
   ========================================================================= */
window.App = (function () {
  const D = window.GLACIER_DATA;
  const state = { year: D.LAST, page: "home", selected: null };
  const listeners = [];
  const pages = {}; // name -> { show(), hide() }

  const fmt = (n, d = 1) => n.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
  const signed = (n, d = 1) => (n > 0 ? "+" : n < 0 ? "−" : "±") + fmt(Math.abs(n), d);
  const $ = (id) => document.getElementById(id);

  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach((fn) => fn(state)); }

  function setYear(y) {
    y = Math.max(D.FIRST, Math.min(D.LAST, Math.round(y)));
    if (y === state.year) return;
    state.year = y; emit();
  }

  function registerPage(name, api) { pages[name] = api; }

  function go(page, scrollTo) {
    if (!pages[page]) page = "home";
    state.page = page;
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("is-active", p.id === "page-" + page));
    document.body.classList.toggle("detail", page !== "home");
    document.querySelectorAll(".main-nav a").forEach((a) => a.classList.toggle("is-active", a.dataset.go === page && !a.dataset.scroll));
    Object.entries(pages).forEach(([n, p]) => (n === page ? p.show() : p.hide()));
    if (page !== "map") state.selected = null;
    history.replaceState(null, "", "#" + page);
    if (scrollTo) {
      const el = $(scrollTo === "stats" ? "home-stats" : "home-sources");
      setTimeout(() => el && el.scrollIntoView({ behavior: "smooth" }), 50);
    } else if (page === "home") $("page-home").scrollTo({ top: 0 });
    emit();
  }

  function selectGlacier(id) { state.selected = id; emit(); }

  // ---------- Tooltip ----------
  function showTip(html, evt) {
    const t = $("tooltip"), box = document.querySelector(".content").getBoundingClientRect();
    t.innerHTML = html;
    t.style.left = evt.clientX - box.left + "px";
    t.style.top = evt.clientY - box.top + "px";
    t.classList.add("show");
  }
  function hideTip() { $("tooltip").classList.remove("show"); }

  // ---------- Zahlen (Info-Karte + Kennzahlen Startseite) ----------
  function renderInfo() {
    const y = state.year, v = D.vol(y);
    const pct = v / D.V0 * 100, lost = v - D.V0;
    $("info-year").textContent = y;
    $("hero-vol").textContent = fmt(v);
    $("hero-bar").style.width = pct + "%";
    $("hero-pct").textContent = fmt(pct, 0) + " %";
    $("loss-total").textContent = signed(lost) + " km³";
    $("loss-biel").textContent = lost < -0.5 ? "≈ " + fmt(Math.abs(lost) / D.BIELERSEE, 0) + " × Bielersee" : "kaum Veränderung";
    $("loss-year").textContent = y === D.FIRST ? "Start" : signed(D.change(y)) + " km³";
    $("loss-year-pct").textContent = y === D.FIRST ? "1970 = 100 %" : signed(D.changePct(y)) + " %";
    const hot = D.hotSummers[y], ev = D.events.find((e) => e.year === y);
    const note = $("year-note");
    note.textContent = hot ? "Heisser Sommer · " + hot : ev ? ev.label : "";
    note.classList.toggle("hot", !!hot);
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", +c.dataset.year === y));

    $("st-pct").textContent = signed(pct - 100, 0);
    $("st-vol").textContent = fmt(v);
    document.querySelectorAll(".yr").forEach((e) => (e.textContent = y));
  }

  function buildChips() {
    const wrap = $("hot-chips");
    Object.keys(D.hotSummers).forEach((y) => {
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = y; b.dataset.year = y; b.title = D.hotSummers[y];
      b.addEventListener("click", () => setYear(+y));
      wrap.appendChild(b);
    });
  }

  function start() {
    buildChips();
    document.querySelectorAll("[data-go]").forEach((el) =>
      el.addEventListener("click", (e) => { e.preventDefault(); go(el.dataset.go, el.dataset.scroll); }));
    document.querySelectorAll(".cube-card").forEach((el) =>
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") el.click(); }));
    onChange(renderInfo);

    Timeline.init();
    Home.init();
    MapView.init();
    CubeView.init();

    go(location.hash.replace("#", "") || "home");
  }

  return { state, D, setYear, go, registerPage, selectGlacier, onChange, emit, start, fmt, signed, $, showTip, hideTip };
})();
