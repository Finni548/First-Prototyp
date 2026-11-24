/* =========================================================================
   Timeline rechts – vertikal von 1970 (oben) bis 2026 (unten)
   Ziehen, Klicken, Mausrad, Pfeiltasten oder Play.
   Die blassen Balken sind gleichzeitig eine Mini-Grafik des Eisvolumens.
   ========================================================================= */
window.Timeline = (function () {
  const D = GLACIER_DATA;
  let track, svg, handle, handleYear, playBtn;
  let H = 600, W = 108, timer = null;
  const PAD_T = 14, PAD_B = 14, AXIS_X = 38;

  const yToPx = (yr) => PAD_T + (yr - D.FIRST) / (D.LAST - D.FIRST) * (H - PAD_T - PAD_B);
  const pxToYear = (px) => D.FIRST + (px - PAD_T) / (H - PAD_T - PAD_B) * (D.LAST - D.FIRST);

  function draw() {
    const r = track.getBoundingClientRect();
    H = r.height; W = r.width;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = "";
    const g = App.svgEl("g", {}, svg);
    const step = (H - PAD_T - PAD_B) / (D.LAST - D.FIRST);
    const barMax = W - AXIS_X - 4;

    // Volumen-Balken (Mini-Grafik)
    D.years.forEach((yr) => {
      const y = yToPx(yr);
      App.svgEl("rect", {
        class: "tl-vol" + (yr <= App.state.year ? " past" : ""),
        x: AXIS_X + 3, y: y - Math.max(1, step * 0.32),
        width: Math.max(1, barMax * D.vol(yr) / D.V0),
        height: Math.max(1.5, step * 0.64), rx: 1
      }, g);
    });

    // Achse
    App.svgEl("line", { class: "tl-axis", x1: AXIS_X, x2: AXIS_X, y1: PAD_T, y2: H - PAD_B }, g);

    D.years.forEach((yr) => {
      const y = yToPx(yr);
      const major = yr % 5 === 0 || yr === D.LAST;
      const hot = !!D.hotSummers[yr];
      App.svgEl("line", { class: "tl-tick" + (major ? " major" : ""), x1: AXIS_X - (major ? 7 : 3), x2: AXIS_X, y1: y, y2: y }, g);
      if (hot) App.svgEl("circle", { class: "tl-hot", cx: AXIS_X, cy: y, r: 3.2 }, g);
      if (major || hot) {
        const t = App.svgEl("text", { class: "tl-label" + (hot ? " hot" : ""), x: AXIS_X - 10, y: y + 3.5, "text-anchor": "end" }, g);
        t.textContent = yr;
      }
    });

    // Ereignisse
    D.events.forEach((e) => {
      const y = yToPx(e.year);
      const p = App.svgEl("path", { class: "tl-event", d: `M${AXIS_X - 4},${y} l4,-4 l4,4 l-4,4z` }, g);
      const tt = App.svgEl("title", {}, p); tt.textContent = e.year + ": " + e.label;
    });

    placeHandle();
  }

  function placeHandle() {
    handle.style.top = yToPx(App.state.year) + "px";
    handleYear.textContent = App.state.year;
    track.setAttribute("aria-valuenow", App.state.year);
    svg.querySelectorAll(".tl-vol").forEach((r, i) => r.classList.toggle("past", D.FIRST + i <= App.state.year));
  }

  function fromEvent(e) {
    const r = track.getBoundingClientRect();
    App.setYear(pxToYear(e.clientY - r.top));
  }

  function play() {
    if (timer) return stop();
    if (App.state.year >= D.LAST) App.setYear(D.FIRST);
    playBtn.classList.add("is-playing");
    playBtn.setAttribute("aria-label", "Pause");
    timer = setInterval(() => {
      if (App.state.year >= D.LAST) return stop();
      App.setYear(App.state.year + 1);
    }, 180);
  }
  function stop() {
    clearInterval(timer); timer = null;
    playBtn.classList.remove("is-playing");
    playBtn.setAttribute("aria-label", "Abspielen");
  }

  function init() {
    track = App.$("tl-track"); svg = App.$("tl-svg");
    handle = App.$("tl-handle"); handleYear = App.$("tl-handle-year"); playBtn = App.$("play-btn");

    track.addEventListener("pointerdown", (e) => {
      stop();
      track.setPointerCapture(e.pointerId);
      document.body.classList.add("dragging");
      fromEvent(e);
    });
    track.addEventListener("pointermove", (e) => { if (track.hasPointerCapture(e.pointerId)) fromEvent(e); });
    track.addEventListener("pointerup", (e) => { track.releasePointerCapture(e.pointerId); document.body.classList.remove("dragging"); });

    track.addEventListener("wheel", (e) => { e.preventDefault(); stop(); App.setYear(App.state.year + Math.sign(e.deltaY)); }, { passive: false });

    window.addEventListener("keydown", (e) => {
      const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); stop(); App.setYear(App.state.year + k); }
      if (e.key === "Home") App.setYear(D.FIRST);
      if (e.key === "End") App.setYear(D.LAST);
      if (e.key === " " && e.target === document.body) { e.preventDefault(); play(); }
    });

    playBtn.addEventListener("click", play);
    App.$("today-btn").addEventListener("click", () => { stop(); App.setYear(D.LAST); });

    window.addEventListener("resize", draw);
    App.onChange(placeHandle);
    requestAnimationFrame(draw);
  }

  return { init, draw };
})();
