# dst-scrollytelling

Scroll-gesteuerte Kartenvisualisierung, Wilma-kompatibel.  
Stack: [MapLibre GL JS](https://maplibre.org/) + [Scrollama](https://github.com/russellsamora/scrollama) + [OpenFreeMap](https://openfreemap.org/) (Positron-Style).

**Live-Demo:** https://lz-digital.github.io/dst-scrollytelling/

---

## Aktueller Stand

- Einbettung ueber `embed.js` ohne Build- oder npm-Schritt.
- Alle Styles sind auf `#dst-scrollytelling` gekapselt.
- Datenquelle ist `data/data.geojson` (jedes Feature = ein Story-Step).
- Desktop und Mobile haben getrennte Scroll-/Kartenlogik.
- Mobile beruecksichtigt den dynamischen LZ-Header (`.SiteHeaderSticky`) ueber eine laufende Hoehenmessung.

---

## Embed im CMS


```html
<div id="dst-scrollytelling"></div>
<script src="https://lz-digital.github.io/dst-scrollytelling/embed.js"></script>
```

Hinweis:
- `embed.js` berechnet den Basis-Pfad ueber `document.currentScript.src`.
- `data/data.geojson` wird relativ zu diesem Script geladen.
- Deshalb muss fuer externe Einbettung die absolute GitHub-Pages-URL verwendet werden.

---

## Derzeitige Konfigurationsmoeglichkeiten

Es gibt aktuell **keine Runtime-Parameter im Embed-Snippet** (z. B. keine `data-*` Attribute).
Konfiguration passiert direkt in `embed.js` und in `data/data.geojson`.

### 1) Technische Konstanten in `embed.js`

| Konstante | Aktueller Wert | Wirkung |
|---|---:|---|
| `MAP_STYLE` | `https://tiles.openfreemap.org/styles/positron` | Basiskarten-Style |
| `MAP_CENTER` | `[0, 20]` | Initiale Kartenmitte |
| `MAP_ZOOM` | `1` | Initialzoom Desktop |
| `MAP_ZOOM_MOBILE` | `0.5` | Initialzoom Mobile |
| `FLY_DURATION` | `1400` | Dauer von `flyTo`/`fitBounds` Animationen (ms) |
| `SCROLL_OFFSET_DESKTOP` | `0.5` | Scrollama Enter-Schwelle Desktop |
| `SCROLL_OFFSET_MOBILE` | `0.8` | Scrollama Enter-Schwelle Mobile |
| `HEADER_HEIGHT_DESKTOP` | `80` | Sticky-Top und Kartenhoehe Desktop |
| `HEADER_HEIGHT_MOBILE` | `97` | Dokumentierter Mobile-Headerwert (Fallback/Referenz) |
| `MOBILE_MQ` | `(max-width: 768px)` | Umschaltung auf Mobile-Layout |
| `BRAND_COLOR` | `#0a94c2` | Akzentfarbe fuer aktive Steps/Layer |
| `ZOOM_FADE_START` | `2.5` | Start Fade-Uebergang Dot/Passkreuz |
| `ZOOM_FADE_END` | `4` | Ende Fade-Uebergang Dot/Passkreuz |

### 2) Verhalten pro Step (Datengetrieben)

Pro Step wird geprueft:
- Wenn `properties.bbox` gueltig ist: Kamera nutzt `map.fitBounds(...)`.
- Sonst: Fallback auf `geometry.coordinates` via `map.flyTo(..., zoom: 8)`.

Damit ist `bbox` die wichtigste inhaltliche Steuerung fuer die Kartenfuehrung.

### 3) Textformatierung in `info`

Unterstuetztes Inline-Format:
- `\n` wird zu Zeilenumbruch (`<br>`).
- `**fett**` wird in `<strong>` umgewandelt.
- HTML wird escaped (kein freies HTML-Markup in Daten).

---

## Datenformat `data/data.geojson`

### Pflichtstruktur

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "index": 0,
        "name": "Name",
        "info": "Beschreibung",
        "bbox": "west,south,east,north"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [lng, lat]
      }
    }
  ]
}
```

### Felder in `properties`

| Feld | Pflicht | Aktuelle Nutzung im Code |
|---|---|---|
| `index` | ja | Nummerierung (Dot-Label `index + 1`) und Highlighting |
| `name` | ja | Titel im Text-Step + Kartenlabel |
| `info` | ja | Fliesstext pro Step, inklusive `\n`/`**...**` |
| `bbox` | empfohlen | Kamera-Ziel via `fitBounds`, Grundlage fuer Passkreuz + Label-Anker |
| `lat` | nein | Derzeit nicht verwendet (nur Datenmetadatum) |
| `lon` | nein | Derzeit nicht verwendet (nur Datenmetadatum) |

### Geometrie

| Feld | Pflicht | Hinweis |
|---|---|---|
| `geometry.type` | ja | `Point` |
| `geometry.coordinates` | ja | `[lng, lat]`; wird als Kamera-Fallback ohne `bbox` genutzt |

---

## Rendering-Logik (kurz)

- Intro-Step (`stepIndex = -1`) wird automatisch vor den Daten-Steps eingefuegt.
- Desktop: Step wird beim Enter sofort aktiv gesetzt; Karte folgt direkt.
- Mobile: Step wird nach Kamerabewegung aktiviert (inkl. Fallback-Timer), um visuelle Spruenge zu reduzieren.
- Layer:
  - `dst-pulsing-dots` (Punkte + Nummern, bei niedrigem Zoom sichtbar)
  - `dst-passkreuz-line` (bbox-Ecken, bei hoeherem Zoom sichtbar)
  - `dst-labels` (Ortsnamen aus `name`, bei hoeherem Zoom sichtbar)

---

## Lokale Entwicklung

```bash
# im Repo-Root
python -m http.server 8000
# oder
python3 -m http.server 8000
```

Dann `http://localhost:8000` oeffnen.

---

## Deployment

- GitHub Pages auf Branch `main` und Root `/`.
- `embed.js` und `data/data.geojson` muessen im gleichen Deploy-Root liegen.
- `.nojekyll` verhindert Jekyll-Verarbeitung auf Pages.

---

## Bekannte Einschraenkungen

- Aktuell auf genau einen Container mit `id="dst-scrollytelling"` ausgelegt.
- Kein externes Konfigurations-API (alle Defaults im Code).
- Mobile Header-Handling ist auf das LZ-DOM (`.SiteHeaderSticky`) optimiert.
- Moderne Browser vorausgesetzt (aktuelle Versionen von Chrome, Firefox, Safari, Edge).
