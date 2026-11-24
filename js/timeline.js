/* =========================================================================
   Zeitleiste rechts – 2026 oben, 1970 unten (wie in den Skizzen)
   - läuft im Cube-Modus von selbst durch (Schleife)
   - Klick / Ziehen / Mausrad / Pfeiltasten auf ein Jahr → bleibt dort stehen
   - ▶ startet die Animation wieder
   ========================================================================= */
window.Timeline = (function () {
  const D = GLACIER_DATA;
  let track, svg, handle, handleYear, playBtn, big;
  let H = 600, W = 92, timer = null, loop = false;
  const PAD_T = 12, PAD_B = 12, AXIS_X = 34, SPEED = 260;
  const svgEl = (tag, attrs = {}, parent) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const yToPx = (yr) => PAD_T + (D.LAST - yr) / (D.LAST - D.FIRST) * (H - PAD_T - PAD_B);
  const pxToYear = (px) => D.LAST - (px - PAD_T) / (H - PAD_T - PAD_B) * (D.LAST - D.FIRST);

  function draw() {
    const r = track.getBoundingClientRect();
    H = r.height; W = r.width;
    if (!H) return;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = "";
    const step = (H - PAD_T - PAD_B) / (D.LAST - D.FIRST), barMax = W - AXIS_X - 4;
    D.years.forEach((yr) => {
      svgEl("rect", { class: "tl-vol", x: AXIS_X + 3, y: yToPx(yr) - Math.max(1, step * 0.25),
        width: Math.max(1, barMax * D.vol(yr) / D.V0), height: Math.max(1.5, step * 0.5), rx: 0.5 }, svg);
    });
    svgEl("line", { class: "tl-axis", x1: AXIS_X, x2: AXIS_X, y1: PAD_T, y2: H - PAD_B }, svg);
    D.years.forEach((yr) => {
      const y = yToPx(yr), major = yr % 5 === 0 || yr === D.LAST, hot = !!D.hotSummers[yr];
      svgEl("line", { class: "tl-tick" + (major ? " major" : ""), x1: AXIS_X - (major ? 7 : 3), x2: AXIS_X, y1: y, y2: y }, svg);
      if (hot) svgEl("circle", { class: "tl-hot", cx: AXIS_X, cy: y, r: 2.6 }, svg);
      if (major || hot) svgEl("text", { class: "tl-label" + (hot ? " hot" : ""), x: AXIS_X - 10, y: y + 3.5, "text-anchor": "end" }, svg).textContent = yr;
    });
    D.events.forEach((e) => {
      const y = yToPx(e.year);
      svgEl("title", {}, svgEl("path", { class: "tl-event", d: `M${AXIS_X - 4},${y} l4,-4 l4,4 l-4,4z` }, svg)).textContent = e.year + ": " + e.label;
    });
    placeHandle();
  }

  function placeHandle() {
    const y = App.state.year;
    handle.style.top = yToPx(y) + "px";
    handleYear.textContent = y; big.textContent = y;
    big.classList.toggle("hot", !!D.hotSummers[y]);
    track.setAttribute("aria-valuenow", y);
    svg.querySelectorAll(".tl-vol").forEach((r, i) => r.classList.toggle("past", D.FIRST + i <= y));
  }

  function play(opts = {}) {
    stop();
    loop = !!opts.loop;
    if (App.state.year >= D.LAST || opts.fromStart) App.setYear(D.FIRST);
    playBtn.classList.add("is-playing"); playBtn.setAttribute("aria-label", "Pause");
    document.body.classList.add("tl-playing");
    let hold = 0;
    timer = setInterval(() => {
      if (App.state.year >= D.LAST) {
        if (!loop) return stop();
        if (++hold < 8) return;          // kurz bei 2026 stehen bleiben, dann von vorne
        hold = 0; App.setYear(D.FIRST); return;
      }
      App.setYear(App.state.year + 1);
    }, SPEED);
  }
  function stop() {
    clearInterval(timer); timer = null;
    playBtn.classList.remove("is-playing"); playBtn.setAttribute("aria-label", "Abspielen");
    document.body.classList.remove("tl-playing");
  }
  const isPlaying = () => !!timer;

  function fromEvent(e) { const r = track.getBoundingClientRect(); App.setYear(pxToYear(e.clientY - r.top)); }

  function init() {
    track = App.$("tl-track"); svg = App.$("tl-svg"); big = App.$("tl-big");
    handle = App.$("tl-handle"); handleYear = App.$("tl-handle-year"); playBtn = App.$("play-btn");

    track.addEventListener("pointerdown", (e) => { stop(); track.setPointerCapture(e.pointerId); document.body.classList.add("dragging"); fromEvent(e); });
    track.addEventListener("pointermove", (e) => { if (track.hasPointerCapture(e.pointerId)) fromEvent(e); });
    track.addEventListener("pointerup", (e) => { track.releasePointerCapture(e.pointerId); document.body.classList.remove("dragging"); });
    track.addEventListener("wheel", (e) => { e.preventDefault(); stop(); App.setYear(App.state.year - Math.sign(e.deltaY)); }, { passive: false });

    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      const k = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); stop(); App.setYear(App.state.year + k); }
      if (e.key === "Home") { stop(); App.setYear(D.LAST); }
      if (e.key === "End") { stop(); App.setYear(D.FIRST); }
      if (e.key === " " && e.target === document.body) { e.preventDefault(); isPlaying() ? stop() : play({ loop: true }); }
    });
    playBtn.addEventListener("click", () => (isPlaying() ? stop() : play({ loop: App.state.mode !== "overview" })));
    App.$("today-btn").addEventListener("click", () => { stop(); App.setYear(D.LAST); });

    new ResizeObserver(draw).observe(track);
    App.onChange(placeHandle);
    requestAnimationFrame(draw);
  }

  return { init, draw, play, stop, isPlaying };
})();
