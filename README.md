# Schmelzpunkt – Prototyp 2 (Data Vis)

Helle Version, Layout angelehnt an simslifecycle.com. Alles in 3D (Three.js, liegt lokal in `js/vendor/`).
Der erste, dunkle Prototyp liegt unverändert im Unterordner `Prototyp 1 (dunkel)`.

## Öffnen
- `index.html` doppelklicken – läuft ohne Server.
- Oder in VS Code mit der Extension **Live Server** (Rechtsklick auf `index.html` → *Open with Live Server*).
- Die Schriften (Fraunces, Manrope) kommen von Google Fonts → brauchen Internet, sonst greift eine Ersatzschrift.

## Aufbau
- **Startseite:** links der Karten-Cube (Relief der Schweiz im Glaskasten, reagiert auf die Maus), rechts der Eis-Cube, der sich dreht, bis man draufklickt. Klick öffnet die jeweilige Ansicht.
- **Karte:** Relief zum Drehen (ziehen) und Zoomen (scrollen). Eisflächen schrumpfen mit dem Jahr. Feine Beschriftungen mit Leitlinien – sie verteilen sich automatisch, damit nichts überlappt; ausgeblendete erscheinen beim Darüberfahren.
- **Eisblock:** Glaswürfel = Eis von 1970. Der Eisblock hat eine Berglandschaft aus Eis als Oberfläche und sinkt mit jedem Jahr. Ringe am Glas: gestrichelt = 1970, orange = heisse Sommer, blau = gewähltes Jahr.
- **Zeitleiste rechts:** überall gleich – ziehen, klicken, Mausrad, Pfeiltasten, ▶ abspielen, „Heute“ = 2026.

## Dateien
| Datei | Inhalt |
|---|---|
| `index.html` | Seitenstruktur (Startseite, Karte, Eisblock, Zeitleiste) |
| `css/style.css` | Styling – Farben & Schriften oben in `:root` |
| `js/data.js` | **alle Daten** – hier echte GLAMOS-Werte eintragen |
| `js/switzerland.js` | Relief, Landesgrenze, Seen |
| `js/scene.js` | 3D-Kern: Bühne, Relief-Diorama, Eisblock |
| `js/main.js` | gemeinsamer Zustand, Seitenwechsel, Zahlen-Karte |
| `js/home.js` · `js/mapview.js` · `js/cubeview.js` | die drei Ansichten |
| `js/timeline.js` | Zeitleiste |

## Wichtig zu den Daten
- Gesichert (GLAMOS/SCNAT): 2000 = 74.9 km³, 2024 = 46.5 km³, 2025 −3 %, 2026 −5.5 % → 42.6 km³; 1019 verschwundene Gletscher 1973–2016.
- Zwischenjahre, Gletscherflächen und das **Relief sind für den Prototyp geschätzt bzw. schematisch erzeugt** (kein echtes Höhenmodell).
- Für die finale Version: Höhenmodell von swisstopo (z. B. DHM25 / swissALTI3D, stark verkleinert) und GLAMOS-Reihen einbauen.
