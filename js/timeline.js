/* =========================================================================
   Zeitleiste rechts – nur Jahreszahlen, 2026 oben
   - gewähltes Jahr: dunkel und fett · 2026 (heute) immer blau
   - Klick auf eine Zahl, Ziehen, Mausrad, Pfeiltasten → Jahr wählen (stoppt Auto-Play)
   - ▶ spielt die Jahre ab; im Cube-Modus läuft es von selbst (Schleife)
   ========================================================================= */
window.Timeline = (function () {
  const D = GLACIER_DATA;
  let track, list, playBtn, big;
  let timer = null, loop = false;

  function build() {
    list.innerHTML = "";
    for (let y = D.LAST; y >= D.FIRST; y--) {
      const b = document.createElement("button");
      b.className = "tl-year" + (y === D.LAST ? " is-now" : "") + (y % 5 === 0 || y === D.LAST ? " major" : "");
      b.textContent = y; b.dataset.year = y; b.tabIndex = -1;
      b.addEventListener("click", () => { stop(); App.setYear(y); });
      list.appendChild(b);
    }
  }

  function mark() {
    const y = App.state.year;
    list.querySelectorAll(".tl-year").forEach((b) => b.classList.toggle("is-sel", +b.dataset.year === y));
    big.textContent = y;
    big.classList.toggle("is-now", y === D.LAST);
    track.setAttribute("aria-valuenow", y);
  }

  // Ziehen über die Liste
  function yearAt(clientY) {
    const r = list.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    return Math.round(D.LAST - t * (D.LAST - D.FIRST));
  }

  function play(opts = {}) {
    stop();
    loop = !!opts.loop;
    if (App.state.year >= D.LAST || opts.fromStart) App.setYear(D.FIRST);
    playBtn.classList.add("is-playing"); playBtn.setAttribute("aria-label", "Pause");
    let hold = 0;
    timer = setInterval(() => {
      if (App.state.year >= D.LAST) {
        if (!loop) return stop();
        if (++hold < 8) return;
        hold = 0; App.setYear(D.FIRST); return;
      }
      App.setYear(App.state.year + 1);
    }, 260);
  }
  function stop() {
    clearInterval(timer); timer = null;
    playBtn.classList.remove("is-playing"); playBtn.setAttribute("aria-label", "Abspielen");
  }
  const isPlaying = () => !!timer;

  function init() {
    track = App.$("tl-track"); list = App.$("tl-list"); big = App.$("tl-big"); playBtn = App.$("play-btn");
    build();
    let dragging = false;
    list.addEventListener("pointerdown", (e) => { dragging = true; stop(); list.setPointerCapture(e.pointerId); App.setYear(yearAt(e.clientY)); });
    list.addEventListener("pointermove", (e) => { if (dragging) App.setYear(yearAt(e.clientY)); });
    list.addEventListener("pointerup", (e) => { dragging = false; list.releasePointerCapture(e.pointerId); });
    track.addEventListener("wheel", (e) => { e.preventDefault(); stop(); App.setYear(App.state.year - Math.sign(e.deltaY)); }, { passive: false });
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      const k = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); stop(); App.setYear(App.state.year + k); }
      if (e.key === " " && e.target === document.body) { e.preventDefault(); isPlaying() ? stop() : play({ loop: true }); }
    });
    playBtn.addEventListener("click", () => (isPlaying() ? stop() : play({ loop: App.state.mode === "cube" })));
    App.onChange(mark);
    mark();
  }

  return { init, play, stop, isPlaying, draw: () => {} };
})();
