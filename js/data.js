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
    2003: "Jahrhundertsommer – bis dahin grösster Eisverlust",
    2015: "Hitzewellen im Juli",
    2018: "Trockener Hitzesommer",
    2019: "Hitzewellen Juni & Juli – Pizolgletscher offiziell verabschiedet",
    2022: "Rekordjahr: über 6 % Volumen in einem Sommer",
    2023: "Zweitgrösster Verlust – 2022 + 2023 zusammen −10 %",
    2026: "−5.5 % in einem Sommer: nur 2022 war schlimmer"
  };

  // Ereignisse, die zusätzlich auf der Timeline / Karte erscheinen
  const events = [
    { year: 1985, label: "Ende der Vorstossphase – ab hier schrumpfen fast alle Gletscher" },
    { year: 2019, label: "Pizolgletscher (SG) verschwindet", glacier: "pizol" },
    { year: 2025, label: "Birchgletscher (VS) kollabiert – Blatten verschüttet", glacier: "birch" }
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
    { id: "birch",      name: "Birchgletscher",           canton: "VS", lon: 7.84, lat: 46.40, a1973: 0.6,  a2016: 0.45, goneYear: 2025, goneText: "Kollaps am 28. Mai 2025" },
    { id: "pizol",      name: "Pizolgletscher",           canton: "SG", lon: 9.39, lat: 46.96, a1973: 0.3,  a2016: 0.1,  goneYear: 2019, goneText: "2019 offiziell verabschiedet" }
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

  return { volume, hotSummers, events, glaciers, years, FIRST, LAST, V0, BIELERSEE, vol, change, changePct, area };
})();
