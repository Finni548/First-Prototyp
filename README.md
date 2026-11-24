# Swiss Glaciers – Prototyp 3 (Data Vis)

Helle Version (Layout angelehnt an simslifecycle.com), Ablauf nach euren Papier-Skizzen.
Der erste, dunkle Prototyp liegt im Unterordner `Prototyp 1 (dunkel)`.

## Öffnen
- `index.html` doppelklicken – läuft ohne Server (oder VS Code → Live Server).
- Schriften (Fraunces, Manrope) kommen von Google Fonts → brauchen Internet.

## Ablauf (wie in den Skizzen)
1. **Übersicht (Skizze 1):** Karte gross links, Cube rechts unten (dreht sich), Text unten links, Suche oben rechts, Zeitleiste rechts mit 2026 oben.
2. **Klick auf den Cube (Skizze 1B):** Die Drehung stoppt, derselbe blaue Eisblock wird einfach gross (leicht durchsichtig). Die Karte bleibt blass oben links im Hintergrund.
   Im Cube liegt jedes Jahr als eigene Eis-Ebene (Zickzack-Rand) übereinander. **Die gemeinte Ebene leuchtet:** das Jahr der Zeitleiste, die Ebene unter der Maus und alle angeklickten (festgehaltenen) Ebenen. „Auswahl löschen“ oben rechts setzt zurück.
   Auf den Gipfeln stehen Bohrkern-Zylinder der grössten Gletscher – Klick öffnet den Gletscher.
   Die **Zeitleiste läuft von selbst** (1970 → 2026, Schleife). Klick auf ein Jahr → sie bleibt dort stehen. ▶ startet sie wieder.
3. **Klick auf einen Gletscher (Skizze 2B):** Gletscher in Jahres-Layers (1985 · 2000 · 2015 · 2026) übereinander, auf jedem Layer ein Zylinder = Eiskernbohrung. Das Layer zum gewählten Jahr ist blau markiert. Oben links: Foto des Gletschers.
   Auch über die **Suche** oder per Klick auf der Karte erreichbar.
4. **↵** unten links geht einen Schritt zurück.

## Fotos
In `img/gletscher/` ablegen, Dateiname = Gletscher-ID (z. B. `aletsch.jpg`) – Liste in `img/gletscher/LIES-MICH.txt`.
Solange kein Foto da ist, erscheint ein Platzhalter (und die Browser-Konsole meldet die fehlende Datei – das ist normal).

## Dateien
| Datei | Inhalt |
|---|---|
| `index.html` | Seitenstruktur |
| `css/style.css` | Styling – Farben & Schriften oben in `:root`, Panel-Positionen pro Zustand (`.state-overview/-cube/-glacier`) |
| `js/data.js` | **alle Daten** – hier echte GLAMOS-Werte eintragen |
| `js/switzerland.js` | Relief, Landesgrenze, Seen |
| `js/scene.js` | 3D-Kern: Bühne, Relief, Eisblock, Bohrkern, Beschriftungen |
| `js/main.js` | Zustand & Navigation, Zahlen-Karte, Suche |
| `js/home.js` | Startseite (Karte, Titel, Zustände) |
| `js/cubeview.js` | Inhalt des Cubes: Eisblock → Berglandschaft → Gletscher-Layers |
| `js/mapview.js` | Karte als eigene Seite |
| `js/timeline.js` | Zeitleiste (2026 oben, Auto-Play) |

## Wichtig zu den Daten
- Gesichert (GLAMOS/SCNAT): 2000 = 74.9 km³, 2024 = 46.5 km³, 2025 −3 %, 2026 −5.5 % → 42.6 km³; 1019 verschwundene Gletscher 1973–2016.
- Zwischenjahre, Gletscherflächen, Eisflächen-Formen und das Relief sind **geschätzt bzw. schematisch**.
- Bohrkern-Zylinder sind Platzhalter (Höhe = Flächenanteil), noch keine echten Eiskern-Daten.
