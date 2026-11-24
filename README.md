# Swiss Glaciers – Prototyp 3 (Data Vis)

Helle Version (Layout angelehnt an simslifecycle.com), Ablauf nach euren Papier-Skizzen.
Der erste, dunkle Prototyp liegt im Unterordner `Prototyp 1 (dunkel)`.

## Öffnen
- `index.html` doppelklicken – läuft ohne Server (oder VS Code → Live Server).
- Schriften (Fraunces, Manrope) kommen von Google Fonts → brauchen Internet.

## Ablauf – zwei Wege (wie in den Skizzen)

**Cube-Weg**
1. **Übersicht (Skizze 1):** Karte links, Cube rechts (dreht sich), Text unten, Suche oben, Zeitleiste rechts (2026 oben).
2. **Klick auf den Cube (1B):** Drehung stoppt, Cube wird gross, die Karte bleibt blass oben links. Jedes Jahr = eigene Eis-Ebene, die gemeinte leuchtet (Zeitleiste / Maus / Klick = festhalten). Zeitleiste läuft von selbst.
3. **Klick auf einen Bohrkern-Zylinder:** derselbe Würfel nur für diesen Gletscher, vor dem Berg-Foto mit Cutout.

**Karten-Weg**
1. **Klick auf die Karte:** Karte wird gross (drehen/zoomen), der Cube rückt blass in den Hintergrund. Feine Beschriftungen aller Gletscher.
2. **Klick auf einen Gletscher (Skizze 1A „Area from one Glacier“):** das Gebiet gross als 3D-Topografie mit Höhenlinien (alle 100 m), Eisflächen und Bohrkern-Zylindern. Unten rechts klein der Cube dieses Gletschers (Klick → Cube-Weg).
3. **Klick auf einen Bohrkern (Skizze 2A „Probe Way“):** Karte klein oben links, Foto mit Bohrstelle, der Eiskern als Zylinder mit Jahres-Ringen (Jahr der Zeitleiste blau schraffiert), rechts ein echtes Eiskern-Foto und die **Real-Data-Tabelle** (Schalter ein/aus).
   - **Echte Bohrungen:** *Colle Gnifetti* (im Gebiet Gornergletscher) und *Fiescherhorn* (im Gebiet Aletsch / Fiescher) – orange Zylinder.
   - Die übrigen Bohrkerne sind Platzhalter; ihre Tabelle verweist auf die echten.

Oben in jeder Ansicht: **↵** (einen Schritt zurück) und der Pfad, z. B. *Übersicht / Karte / Gornergletscher* – jeder Teil ist anklickbar.

## Bilder
- Eiskern-Foto: wird online von Wikimedia Commons geladen (GISP2-Eiskern, National Ice Core Laboratory/USGS, gemeinfrei). Für offline: eigenes Foto als `img/eiskern.jpg` ablegen – es hat Vorrang.
`img/berg-cutout.png` ist euer hochgeladenes Berg-Bild – freigestellt (das eingebrannte Schachbrett-Muster wurde entfernt).
Falls es von einer Stock-Seite stammt (z. B. Freepik): Lizenz/Quellenangabe prüfen und im Footer nennen.

## Dateien
| Datei | Inhalt |
|---|---|
| `index.html` | Seitenstruktur |
| `css/style.css` | Styling – alle Farben, Schriftgrössen und Abstände als Variablen oben in `:root` (Firn-Hintergrund, Haarlinie, Gletscherblau = gewählt, Orange = heisse Sommer) |
| `js/data.js` | **alle Daten** – hier echte GLAMOS-Werte eintragen |
| `js/switzerland.js` | Relief, Landesgrenze, Seen |
| `js/scene.js` | 3D-Kern: Bühne, Relief, Eisblock, Bohrkern, Beschriftungen |
| `js/main.js` | Zustand & Navigation, Zahlen-Karte, Suche |
| `js/home.js` | Startseite (Karte, Titel, Zustände) |
| `js/cubeview.js` | Cube: Eisblock mit Jahres-Ebenen (klein & gross) |
| `js/glacierview.js` | Gletscher-Ansicht: Berg-Foto, Cutout-Fenster, Datentabelle (der Würfel selbst kommt aus cubeview.js) |
| `js/mapview.js` | Karten-Weg: Karte gross, Gletscher-Gebiet mit Höhenlinien & Bohrkernen |
| `js/probe.js` | Kernbohrung: Eiskern-Zylinder, Foto, Real-Data-Tabelle |
| `js/timeline.js` | Zeitleiste (2026 oben, Auto-Play) |

## Wichtig zu den Daten
- **Echte Eiskern-Daten** stehen in `js/data.js` unter `realCores` (mit Quellen-Links): Colle Gnifetti 2021 – 2 Kerne bis zum Fels in 82 m, bis ca. 10 000 Jahre; Fiescherhorn 2002 – 150 m Kern, ca. 1660–2002. Bei Colle Gnifetti ist die Lage der Jahres-Ringe schematisch, bei Fiescherhorn eine lineare Näherung (oberste 108 m ≈ 1943–2002).
- Gesichert (GLAMOS/SCNAT): 2000 = 74.9 km³, 2024 = 46.5 km³, 2025 −3 %, 2026 −5.5 % → 42.6 km³; 1019 verschwundene Gletscher 1973–2016.
- Zwischenjahre, Gletscherflächen, Eisflächen-Formen und das Relief sind **geschätzt bzw. schematisch**.
- Bohrkern-Zylinder sind Platzhalter, noch keine echten Eiskern-Daten.
- Der Eis-Anteil eines einzelnen Gletschers ist **aus seiner Flächenänderung modelliert** (Volumen ≈ Fläche^1.36) – für echte Werte: GLAMOS-Volumen/Massenbilanz pro Gletscher.
