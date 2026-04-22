# dst-scrollytelling

Scroll-gesteuerte Kartenvisualisierung für das LZ-Digital CMS.  
Gebaut mit [MapLibre GL JS](https://maplibre.org/) + [Scrollama](https://github.com/russellsamora/scrollama) + [OpenFreeMap](https://openfreemap.org/) (Positron-Style).

**Live-Demo:** https://lz-digital.github.io/dst-scrollytelling/

---

## Embed-Snippet (CMS)

```html
<div id="dst-scrollytelling"></div>
<script src="https://lz-digital.github.io/dst-scrollytelling/embed.js"></script>
```

Beide Zeilen werden im CMS-Editor an der Stelle `###HIER STEHT DAS EMBED###` eingefügt.

---

## Funktionsweise

- `embed.js` lädt MapLibre GL JS und Scrollama automatisch von CDN (kein Build-Schritt nötig).
- Die Karte bleibt beim Scrollen sticky rechts fixiert; die Text-Schritte scrollen links.
- Daten kommen aus `data/data.geojson` — jedes Feature = ein Scroll-Schritt.
- CSS ist vollständig in `#dst-scrollytelling` gekapselt (keine Side-Effects auf die Host-Seite).

---

## GeoJSON-Datenformat (`data/data.geojson`)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "index":   0,
        "name":    "Name des Ortes",
        "info":    "Text für den Scroll-Schritt.\nZeilenumbrüche mit \\n.",
        "zoom":    8,
        "bearing": 0,
        "pitch":   0
      },
      "geometry": {
        "type": "Point",
        "coordinates": [lng, lat]
      }
    }
  ]
}
```

| Feld | Pflicht | Beschreibung |
|---|---|---|
| `index` | ja | Ganzzahl ab 0, eindeutig pro Feature — für Marker-Highlighting |
| `name` | ja | Überschrift im Text-Panel |
| `info` | ja | Fließtext; `\n` wird zu `<br>` |
| `zoom` | nein | Karten-Zoom beim flyTo (Standard: 8) |
| `bearing` | nein | Karten-Drehung in Grad (Standard: 0) |
| `pitch` | nein | Neigung in Grad (Standard: 0) |

---

## Lokale Entwicklung

```bash
# Im Repository-Verzeichnis:
python3 -m http.server 8000
# → http://localhost:8000
```

Kein Build-Schritt, kein npm. Alle Abhängigkeiten werden von CDN geladen.

---

## Deployment (GitHub Pages)

- Branch `main`, Verzeichnis `/` als Pages-Quelle konfigurieren
- `.nojekyll` im Root verhindert Jekyll-Verarbeitung
- Nach jedem Push auf `main` ist die Demo automatisch aktuell

---

## Einschränkungen

- **Ein Embed pro Seite** (der Container benötigt `id="dst-scrollytelling"`)
- Moderne Browser (Chrome, Firefox, Safari, Edge — aktuelle Versionen)
- Für Cross-Origin-Einbettung muss `embed.js` per absolutem URL eingebunden werden (GitHub Pages URL), damit der relative GeoJSON-Pfad korrekt aufgelöst wird
