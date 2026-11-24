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
  const volume = {
    1970: 85.0, 1971: 84.6, 1972: 84.7, 1973: 84.3, 1974: 84.4,
    1975: 84.5, 1976: 84.0, 1977: 84.6, 1978: 85.1, 1979: 85.0,
    1980: 85.4, 1981: 85.1, 1982: 84.4, 1983: 84.0, 1984: 84.2,
    1985: 83.6, 1986: 82.9, 1987: 82.8, 1988: 82.2, 1989: 81.5,
    1990: 80.4, 1991: 79.3, 1992: 78.6, 1993: 78.4, 1994: 77.6,
    1995: 77.3, 1996: 77.2, 1997: 76.9, 1998: 75.8, 1999: 75.6,
    2000: 74.9, 2001: 74.7, 2002: 73.9, 2003: 71.1, 2004: 70.2,
    2005: 69.2, 2006: 67.9, 2007: 67.1, 2008: 66.4, 2009: 65.3,
    2010: 64.8, 2011: 63.5, 2012: 62.3, 2013: 62.0, 2014: 61.8,
    2015: 59.9, 2016: 59.0, 2017: 57.6, 2018: 56.1, 2019: 55.0,
    2020: 54.0, 2021: 53.6, 2022: 50.3, 2023: 48.1, 2024: 46.5,
    2025: 45.1, 2026: 42.6
  };

  // Hitzesommer / Rekord-Schmelzjahre – erscheinen orange in der Timeline
  const hotSummers = {
    2003: "Summer of the century, the biggest ice loss up to then",
    2015: "Heatwaves in July",
    2018: "Dry, hot summer",
    2019: "Heatwaves in June and July; a farewell ceremony for the Pizol glacier",
    2022: "Record year: over 6% of the ice lost in one summer",
    2023: "Second-largest loss; 2022 and 2023 together −10%",
    2026: "−5.5% in one summer: only 2022 was worse"
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
    const v73 = volume[1973], v16 = volume[2016];
    let f = (volume[y] - v16) / (v73 - v16);   // 1 = Stand 1973, 0 = Stand 2016
    if (f < 0) f *= 0.5;                       // nach 2016: Fläche schrumpft langsamer als Volumen
    return Math.max(0.02, g.a2016 + (g.a1973 - g.a2016) * Math.min(f, 1.05));
  }

  return { volume, hotSummers, events, glaciers, realCores, years, FIRST, LAST, V0, BIELERSEE, vol, change, changePct, area };
})();
