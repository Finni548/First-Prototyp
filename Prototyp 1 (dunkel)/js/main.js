/* =========================================================================
   App – gemeinsamer Zustand (Jahr, Ansicht) für Timeline, Eisblock & Karte
   ========================================================================= */
window.App = (function () {
  const D = window.GLACIER_DATA;
  const state = { year: D.LAST, view: "cube", selected: null };
  const listeners = [];

  // ---------- Hilfsfunktionen ----------
  const fmt = (n, d = 1) => n.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
  const signed = (n, d = 1) => (n > 0 ? "+" : n < 0 ? "−" : "±") + fmt(Math.abs(n), d);
  const $ = (id) => document.getElementById(id);
  const svgEl = (tag, attrs = {}, parent) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };

  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach((fn) => fn(state)); }

  function setYear(y) {
    y = Math.max(D.FIRST, Math.min(D.LAST, Math.round(y)));
    if (y === state.year) return;
    state.year = y;
    emit();
  }

  function setView(v) {
    state.view = v;
    document.querySelectorAll(".view-btn").forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on);
    });
    document.querySelectorAll(".view").forEach((s) => s.classList.toggle("is-active", s.id === "view-" + v));
    if (v !== "map") selectGlacier(null);
    history.replaceState(null, "", "#" + v);
    emit();
  }

  function selectGlacier(id) {
    state.selected = id;
    emit();
  }

  // ---------- Tooltip ----------
  const tip = () => $("tooltip");
  function showTip(html, evt) {
    const t = tip(), box = document.querySelector(".stage").getBoundingClientRect();
    t.innerHTML = html;
    t.style.left = evt.clientX - box.left + "px";
    t.style.top = evt.clientY - box.top + "px";
    t.classList.add("show");
  }
  function hideTip() { tip().classList.remove("show"); }

  // ---------- Infospalte ----------
  function renderInfo() {
    const y = state.year, v = D.vol(y);
    const pct = v / D.V0 * 100;
    const lost = v - D.V0;
    $("info-year").textContent = y;
    $("hero-vol").textContent = fmt(v);
    $("hero-bar").style.width = pct + "%";
    $("hero-pct").textContent = fmt(pct, 0) + " %";
    $("loss-total").textContent = signed(lost) + " km³";
    $("loss-biel").textContent = lost < -0.5 ? "≈ " + fmt(Math.abs(lost) / D.BIELERSEE, 0) + " × Bielersee" : "kaum Veränderung";
    $("loss-year").textContent = y === D.FIRST ? "Startjahr" : signed(D.change(y)) + " km³";
    $("loss-year-pct").textContent = y === D.FIRST ? "Referenz = 100 %" : signed(D.changePct(y)) + " % gegenüber Vorjahr";

    const note = $("year-note");
    const ev = D.events.find((e) => e.year === y);
    const hot = D.hotSummers[y];
    note.textContent = hot ? "🔥 " + hot : ev ? ev.label : "";
    note.classList.toggle("hot", !!hot);

    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", +c.dataset.year === y));
  }

  function buildChips() {
    const wrap = $("hot-chips");
    Object.keys(D.hotSummers).forEach((y) => {
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = y; b.dataset.year = y;
      b.title = D.hotSummers[y];
      b.addEventListener("click", () => setYear(+y));
      wrap.appendChild(b);
    });
  }

  function start() {
    buildChips();
    document.querySelectorAll(".view-btn").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    $("glacier-close").addEventListener("click", () => selectGlacier(null));
    onChange(renderInfo);

    Timeline.init();
    Cube.init();
    MapView.init();

    const fromHash = location.hash.replace("#", "");
    setView(fromHash === "map" ? "map" : "cube");
  }

  return { state, D, setYear, setView, selectGlacier, onChange, emit, start, fmt, signed, svgEl, $, showTip, hideTip };
})();
