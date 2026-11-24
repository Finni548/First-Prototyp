# Schmelzpunkt – Prototyp 1 (Data Vis)

Datenvisualisierung der Schweizer Gletscher 1970–2026 mit zwei Ansichten und einer gemeinsamen Timeline.

## Öffnen
- **Einfach:** `index.html` im Finder doppelklicken (läuft ohne Server).
- **In VS Code:** Ordner öffnen → Extension **Live Server** installieren → Rechtsklick auf `index.html` → *Open with Live Server*. Dann lädt die Seite bei jeder Änderung neu.

## Bedienung
- Oben rechts zwischen **Eisblock** und **Karte** wechseln (das Jahr bleibt gleich).
- **Timeline rechts:** ziehen, klicken, Mausrad, Pfeiltasten ↑ ↓, `Home` = 1970, `End` = 2026, ▶ = Animation, *Heute* = 2026.
- Orange = heisse Sommer / Rekordschmelzjahre. ◇ = Ereignis.
- Eisblock: über eine abgeschnittene Scheibe fahren → Verlust in diesem Jahr; anklicken → zu dem Jahr springen.
- Karte: Gletscher anklicken → Detailkarte mit Verlauf.

## Dateien
| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst, Infospalte, Timeline |
| `css/style.css` | ganzes Styling (Farben oben in `:root`) |
| `js/data.js` | **alle Daten** – hier echte Werte eintragen |
| `js/main.js` | gemeinsamer Zustand (Jahr, Ansicht), Infospalte |
| `js/timeline.js` | Timeline rechts |
| `js/cube.js` | Ansicht „Der schmelzende Eisblock" |
| `js/map.js` | Ansicht „Karte" |
| `js/switzerland.js` | Umriss, Kantone, Seen (swisstopo, vereinfacht) |

## Daten – bitte beachten
- Gesicherte Fixpunkte (GLAMOS/SCNAT): 2000 = 74.9 km³, 2024 = 46.5 km³, 2025 −3 %, 2026 −5.5 % → 42.6 km³.
- Die übrigen Jahre (v. a. 1970–1999) und die Flächen der einzelnen Gletscher sind **für den Prototyp geschätzt**.
- Nächster Schritt: echte Reihen von https://www.glamos.ch/downloads (Volumen/Massenbilanz, Inventar SGI 1973 & 2016) in `js/data.js` übernehmen.

## Ideen für Prototyp 2 (aus der Skizze)
- Schnitt durch einen Gletscher: Foto + innere Schichten
- Würfel mit Längsschnitten (ein Schnitt pro Gletscher)
- Ausblick bis 2100 (Szenarien)
