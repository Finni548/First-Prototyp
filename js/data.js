/* =========================================================================
   DATEN – Schweizer Gletscher 1970–2026
   -------------------------------------------------------------------------
   PROTOTYP-HINWEIS:
   - Fixpunkte aus GLAMOS / SCNAT-Berichten:
       2000: 74,9 km³ · 2024: 46,5 km³ · 2025: −1,4 km³ (−3 %)
       2026: −2,5 km³ (−5,5 %) → 42,6 km³
       2015–2025: −24 % · 2022+2023 zusammen: −10 %
   - Die Jahre dazwischen und 1970–1999 sind für den Prototyp
     interpoliert/geschätzt (1970–1985 waren die Gletscher fast stabil).
   - Gletscherflächen pro Gletscher sind Näherungswerte (SGI 1973 / 2016).
   → Vor der Abgabe durch echte GLAMOS-Daten ersetzen: glamos.ch/downloads
   ========================================================================= */

window.GLACIER_DATA = (function () {
  // Gesamtvolumen aller Schweizer Gletscher in km³ (Ende Messjahr)
  // ECHT: GLAMOS Swisswide Mass Balance (release 2025), Volumen Ende hydrologisches Jahr, km³.
  // 2026 ist noch nicht im Datensatz: GLAMOS-Jahresbericht vom 1.10.2026 meldet rund −5.5 % → vorläufig.
  const G = window.GLAMOS;
  const volume = {};
  Object.keys(G.vol).forEach((y) => { volume[+y] = G.vol[y]; });
  volume[2026] = +(volume[2025] * (1 - 0.055)).toFixed(3);
  const chAreaRaw = {};
  Object.keys(G.area).forEach((y) => { chAreaRaw[+y] = G.area[y]; });
  chAreaRaw[2026] = chAreaRaw[2025] - (chAreaRaw[2021] - chAreaRaw[2025]) / 4;   // grob fortgeschrieben
  const PROVISIONAL = 2026;

  // Hitzesommer / Rekord-Schmelzjahre – erscheinen orange in der Timeline
  const hotSummers = {
    2003: "Summer of the century: −3.5% of the ice, the biggest loss up to then",
    2015: "Heatwaves in July",
    2018: "Dry, hot summer",
    2019: "Heatwaves in June and July; a farewell ceremony for the Pizol glacier",
    2022: "Record year: −5.9% of the ice in one summer",
    2023: "−4.4% after the record year; 2022 and 2023 together almost −10%",
    2026: "About −5.5% in one summer, second only to 2022 (provisional, GLAMOS report Oct 2026)"
  };

  // Ereignisse, die zusätzlich auf der Timeline / Karte erscheinen
  const events = [
    { year: 1985, label: "End of the advance phase. From here on almost every glacier shrinks." },
    { year: 2019, label: "The Pizol glacier (SG) disappears.", glacier: "pizol" },
    { year: 2025, label: "The Birch glacier (VS) collapses and buries the village of Blatten.", glacier: "birch" }
  ];

  // Ausgewählte Gletscher: Fläche in km² (Näherung SGI 1973 → 2016)
  const glaciers = [
    { id: "aletsch",    name: "Grosser Aletschgletscher", canton: "VS", lon: 8.02, lat: 46.48, a1973: 86.6, a2016: 77.6 },
    { id: "gorner",     name: "Gornergletscher",          canton: "VS", lon: 7.83, lat: 45.96, a1973: 59.7, a2016: 41.0 },
    { id: "fiescher",   name: "Fieschergletscher",        canton: "VS", lon: 8.17, lat: 46.51, a1973: 33.1, a2016: 29.1 },
    { id: "unteraar",   name: "Unteraargletscher",        canton: "BE", lon: 8.23, lat: 46.57, a1973: 28.4, a2016: 22.5 },
    { id: "oberaletsch",name: "Oberaletschgletscher",     canton: "VS", lon: 7.96, lat: 46.42, a1973: 21.7, a2016: 17.3 },
    { id: "findel",     name: "Findelgletscher",          canton: "VS", lon: 7.88, lat: 46.00, a1973: 19.1, a2016: 13.0 },
    { id: "corbassiere",name: "Glacier de Corbassière",   canton: "VS", lon: 7.30, lat: 45.98, a1973: 18.3, a2016: 15.2 },
    { id: "rhone",      name: "Rhonegletscher",           canton: "VS", lon: 8.38, lat: 46.60, a1973: 17.6, a2016: 15.3 },
    { id: "gauli",      name: "Gauligletscher",           canton: "BE", lon: 8.18, lat: 46.62, a1973: 17.7, a2016: 13.2 },
    { id: "trift",      name: "Triftgletscher",           canton: "BE", lon: 8.37, lat: 46.66, a1973: 16.6, a2016: 14.4 },
    { id: "otemma",     name: "Glacier d'Otemma",         canton: "VS", lon: 7.43, lat: 45.94, a1973: 16.6, a2016: 12.6 },
    { id: "morteratsch",name: "Vadret da Morteratsch",    canton: "GR", lon: 9.93, lat: 46.42, a1973: 16.4, a2016: 14.8 },
    { id: "zinal",      name: "Glacier de Zinal",         canton: "VS", lon: 7.63, lat: 46.06, a1973: 15.6, a2016: 12.9 },
    { id: "allalin",    name: "Allalingletscher",         canton: "VS", lon: 7.94, lat: 46.06, a1973: 9.9,  a2016: 8.4 },
    { id: "plainemorte",name: "Glacier de la Plaine Morte",canton: "BE", lon: 7.51, lat: 46.38, a1973: 9.0,  a2016: 7.4 },
    { id: "trient",     name: "Glacier du Trient",        canton: "VS", lon: 7.03, lat: 46.00, a1973: 6.6,  a2016: 5.4 },
    { id: "stein",      name: "Steingletscher",           canton: "BE", lon: 8.43, lat: 46.70, a1973: 6.2,  a2016: 5.1 },
    { id: "clariden",   name: "Claridenfirn",             canton: "GL", lon: 8.87, lat: 46.84, a1973: 5.5,  a2016: 4.0 },
    { id: "tsanfleuron",name: "Glacier de Tsanfleuron",   canton: "VS", lon: 7.23, lat: 46.32, a1973: 3.8,  a2016: 2.5 },
    { id: "silvretta",  name: "Silvrettagletscher",       canton: "GR", lon: 10.08, lat: 46.85, a1973: 3.2, a2016: 2.6 },
    { id: "basodino",   name: "Ghiacciaio del Basòdino",  canton: "TI", lon: 8.47, lat: 46.42, a1973: 2.3,  a2016: 1.6 },
    { id: "birch",      name: "Birchgletscher",           canton: "VS", lon: 7.84, lat: 46.40, a1973: 0.6,  a2016: 0.45, goneYear: 2025, goneText: "Collapsed on 28 May 2025" },
    { id: "pizol",      name: "Pizolgletscher",           canton: "SG", lon: 9.39, lat: 46.96, a1973: 0.3,  a2016: 0.1,  goneYear: 2019, goneText: "Officially declared gone in 2019" }
  ];

  // ECHTE Werte aus dem Gletscherinventar (SGI 1973 / 2016 / 2023) übernehmen:
  // Fläche, Lage (Punkt im Gletscher 2016) und Ausdehnung 1973; dazu die gemessene Längenänderung
  glaciers.forEach((g) => {
    const r = G.glaciers[g.id];
    if (!r) return;
    Object.assign(g, { sgi: r.sgi, a1973: r.a1973, a2016: r.a2016, a2023: r.a2023, lon: r.lon, lat: r.lat, bbox: r.bbox, coreSites: r.cores });
    const L = G.length[g.id];
    if (L && L.gaps <= 5) g.length = L;
  });

  // ECHTE Eiskern-Bohrungen in der Schweiz (Quellen siehe Links)
  const realCores = [
    {
      id: "cg", name: "Colle Gnifetti", lon: 7.876, lat: 45.929,
      where: "Monte Rosa, saddle of the Grenzgletscher (Gorner glacier system), VS",
      elev: "approx. 4450–4500 m a.s.l.",
      drilled: "2021 (Ice Memory)", length: 82, toBedrock: true,
      span: "up to approx. 10,000 years", institutes: "PSI · CNR · Univ. Ca' Foscari Venice",
      facts: [
        ["First drilling here", "1976"],
        ["2013", "Core approx. 73 m to bedrock"],
        ["2021", "2 deep cores to bedrock at 82 m + 3 short ones (15–22 m)"],
        ["Archive", "one core is stored in Antarctica"]
      ],
      sources: [
        ["PSI – Ice Memory Mission accomplished", "https://www.psi.ch/en/news/psi-stories/ice-memory-mission-accomplished"],
        ["Ice Memory – Monte Rosa 2021", "https://www.ice-memory.org/collecting-ice-cores/2021-monte-rosa-italy/"]
      ],
      // Tiefe ↔ Jahr hier im Prototyp nicht bekannt → Schichten SCHEMATISCH in den obersten 20 m
      // (Colle Gnifetti hat sehr wenig Schneezuwachs, die jüngsten Jahrzehnte liegen nahe der Oberfläche)
      depthYear: (y) => (y > 2021 ? null : (2021 - y) / (2021 - 1970) * 20), schematicLayers: true
    },
    {
      id: "fh", name: "Fiescherhorn", lon: 8.067, lat: 46.551,
      where: "Fiescherhorn glacier, Bernese Oberland (46°33′ N, 8°04′ E)",
      elev: "approx. 3900 m a.s.l.",
      drilled: "December 2002 (PSI)", length: 150, toBedrock: false,
      span: "approx. 1660–2002 (base age 340 ± 30 years)", institutes: "Paul Scherrer Institute · Univ. of Bern",
      facts: [
        ["Top 108 m", "≈ 1943–2002"],
        ["Earlier core", "77 m (1989)"],
        ["Dating", "Annual layers counted + nuclear bomb markers 1956/1963"]
      ],
      sources: [
        ["HFSJG Activity Report 2003", "https://www.hfsjg.ch/reports/2003/pdf/23.pdf"],
        ["Jenk 2006, Diss. Univ. Bern", "https://biblio.unibe.ch/download/eldiss/06jenk_tabs.pdf"]
      ],
      // Tiefe in m für ein Jahr (linear: 2002 = 0 m, 1943 = 108 m – Näherung)
      depthYear: (y) => (y > 2002 ? null : (2002 - y) / (2002 - 1943) * 108)
    }
  ];

  const FIRST = 1970, LAST = 2026;
  const years = [];
  for (let y = FIRST; y <= LAST; y++) years.push(y);

  const V0 = volume[FIRST];
  const BIELERSEE = 1.2; // km³ – Vergleichsgrösse (SRF/GLAMOS)

  function vol(y) { return volume[y]; }
  function change(y) { return y > FIRST ? volume[y] - volume[y - 1] : 0; }
  function changePct(y) { return y > FIRST ? (volume[y] - volume[y - 1]) / volume[y - 1] * 100 : 0; }

  // Fläche eines Gletschers in Jahr y – folgt der Form der nationalen Volumenkurve
  function area(g, y) {
    if (g.goneYear && y >= g.goneYear) return 0;
    // Stützpunkte = echte Inventare; dazwischen folgt die Kurve der gesamten Gletscherfläche der Schweiz
    const P = [[1973, g.a1973], [2016, g.a2016], [2023, g.a2023]];
    const A = (yy) => chAreaRaw[yy];
    if (y <= 1973) return g.a1973 * A(y) / A(1973);
    if (y >= 2023) return Math.max(0, g.a2023 - Math.min((g.a2016 - g.a2023) / 7, g.a2023 * 0.025) * (y - 2023));   // eigener Trend 2016–2023 fortgeschrieben (max. 2.5 %/Jahr)
    const [p, q] = y <= 2016 ? [P[0], P[1]] : [P[1], P[2]];
    // Anteil des Flächenverlusts der ganzen Schweiz zwischen den beiden Inventaren, der im Jahr y schon passiert ist
    const s = (A(p[0]) - A(y)) / (A(p[0]) - A(q[0]));
    return Math.max(0, p[1] + (q[1] - p[1]) * s);
  }
  // Längenänderung der Zunge seit 1970 (gemessen, GLAMOS) – null wenn keine Daten
  function lengthChange(g, y) {
    const L = g.length; if (!L || y < L.from) return y <= 1970 && L ? 0 : null;
    return L.cum[Math.min(y, L.to) - L.from];
  }
  const chArea = (y) => chAreaRaw[y];
  // Ausschnitt um einen Gletscher: Mitte = Ausdehnung 1973, gross genug für den ganzen Gletscher
  function boxFor(g, hLon, hLat) {
    const b = g.bbox || [g.lon, g.lat, g.lon, g.lat];
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    const s = Math.max(1, ((b[2] - b[0]) / 2 * 1.18) / hLon, ((b[3] - b[1]) / 2 * 1.18) / hLat);
    return { lon0: cx - hLon * s, lon1: cx + hLon * s, lat0: cy - hLat * s, lat1: cy + hLat * s };
  }

  return { volume, hotSummers, events, glaciers, realCores, years, FIRST, LAST, V0, BIELERSEE, vol, change, changePct, area, lengthChange, chArea, boxFor, PROVISIONAL, vanished: G.vanished, inv: G.inv, Q: G.Q };
})();
