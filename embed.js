(function () {
  'use strict';

  // Capture base URL synchronously — document.currentScript is only valid during
  // synchronous script evaluation, before any async operations.
  const _script = document.currentScript;
  const _base = _script ? _script.src.replace(/\/[^/]*$/, '/') : '';

  const GEOJSON_URL  = _base + 'data/data.geojson';
  const ML_CSS_URL   = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css';
  const ML_JS_URL    = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js';
  const SCRL_JS_URL  = 'https://unpkg.com/scrollama@3/build/scrollama.min.js';
  const MAP_STYLE    = 'https://tiles.openfreemap.org/styles/positron';
  const MAP_CENTER      = [0, 20];
  const MAP_ZOOM        = 1;
  const MAP_ZOOM_MOBILE = 0.5; // zeigt die gesamte Weltkarte auf schmalen Screens
  const CSS_TAG_ID   = 'dst-scrollytelling-styles';
  const ROOT_ID      = 'dst-scrollytelling';
  const BRAND_COLOR  = '#0a94c2'; // #086f91
  const FLY_DURATION = 1400;
  // Must match the mobile @media in injectStyles
  const MOBILE_MQ = '(max-width: 768px)';
  // Scrollama: höherer Wert = Step wird erst „entered“, wenn stärker gescrollt (vorheriger Step eher weg).
  const SCROLL_OFFSET_DESKTOP   = 0.5;
  const SCROLL_OFFSET_MOBILE   = 0.8;

  // Zoom-Schwelle: Punkte sichtbar ↔ Passkreuz sichtbar
  // Dots + Nummern: voll sichtbar bei zoom ≤ 2.5, ausgeblendet bei zoom ≥ 4
  // Passkreuz + Labels: unsichtbar bei zoom ≤ 2.5, voll sichtbar bei zoom ≥ 4
  // ZOOM_FADE_END=4 stellt sicher, dass Dots auch bei großen BBoxen (z.B.
  // Straße von Malakka) auf schmalem Mobile-Screen verschwunden sind.
  const ZOOM_FADE_START = 2.5;
  const ZOOM_FADE_END   = 4;
  const PASSKREUZ_DEFAULT_OPACITY = ['interpolate', ['linear'], ['zoom'], ZOOM_FADE_START, 0,   ZOOM_FADE_END, 0.4];
  const PASSKREUZ_DEFAULT_WIDTH   = ['interpolate', ['linear'], ['zoom'], ZOOM_FADE_START, 0,   ZOOM_FADE_END, 1.5];
  const DOT_ZOOM_OPACITY          = ['interpolate', ['linear'], ['zoom'], ZOOM_FADE_START, 1,   ZOOM_FADE_END, 0  ];

  // ── Utilities ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Fett: **doppelte Sterne** (wie Markdown), kein HTML in den Daten. Pro Segment
  // zuerst escape, dann Zeilenumbrüche — bei unvollständigen ** fällt der ganze
  // Text als nur Text zurück.
  function infoToHtml(str) {
    const s = String(str);
    const parts = s.split('**');
    if (parts.length === 1) {
      return escapeHtml(s).replace(/\n/g, '<br>');
    }
    if (parts.length % 2 === 0) {
      return escapeHtml(s).replace(/\n/g, '<br>');
    }
    return parts
      .map(function (chunk, i) {
        const body = escapeHtml(chunk).replace(/\n/g, '<br>');
        return i % 2 === 1 ? '<strong>' + body + '</strong>' : body;
      })
      .join('');
  }

  function loadCSS(url) {
    if (document.querySelector('link[href="' + url + '"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }

  function loadScript(url, globalKey) {
    return new Promise(function (resolve, reject) {
      if (window[globalKey]) { resolve(); return; }
      // Script tag may already be in DOM (another embed is mid-load) — poll.
      if (document.querySelector('script[src="' + url + '"]')) {
        const t = setInterval(function () {
          if (window[globalKey]) { clearInterval(t); resolve(); }
        }, 50);
        return;
      }
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed to load: ' + url)); };
      document.head.appendChild(s);
    });
  }

  // ── CSS ────────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(CSS_TAG_ID)) return;
    const style = document.createElement('style');
    style.id = CSS_TAG_ID;
    style.textContent = `
#dst-scrollytelling {
  box-sizing: border-box;
  line-height: 1.55;
  color: #222;
  background: #fff;
}
#dst-scrollytelling *, #dst-scrollytelling *::before, #dst-scrollytelling *::after {
  box-sizing: inherit;
}
#dst-scrollytelling .dst-layout {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  width: 100%;
  position: relative;
}
#dst-scrollytelling .dst-map-col {
  width: 60%;
  position: sticky;
  top: 80px;
  height: calc(100vh - 80px);
  z-index: 1;
}
#dst-scrollytelling .dst-map {
  width: 100%;
  height: 100%;
}
#dst-scrollytelling .dst-text-col {
  width: 40%;
  position: relative;
  z-index: 2;
}
#dst-scrollytelling .dst-step {
  min-height: 120vh;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 2rem 1.5rem;
}
/* Wie Kartenhöhe (sticky-Top 80px), Inhalt vertikal in der Spalte zentriert */
#dst-scrollytelling .dst-step-intro {
  min-height: calc(100vh - 80px);
  justify-content: flex-start;
}
#dst-scrollytelling .dst-step-card {
  background: rgba(255, 255, 255, 0.95);
  border-left: 4px solid #ccc;
  padding: 1.25rem 1.25rem 1.25rem 1rem;
  border-radius: 2px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  transition: border-color 0.3s ease;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
#dst-scrollytelling .dst-step.is-active .dst-step-card {
  border-left-color: ${BRAND_COLOR};
}
#dst-scrollytelling .dst-step-title {
  margin: 0 0 0.6rem 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  color: #111;
  white-space: pre-line;
}
#dst-scrollytelling .dst-step-text {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.6;
  color: #333;
}
#dst-scrollytelling .dst-step-text strong {
  font-weight: 700;
  color: #111;
}
#dst-scrollytelling .dst-spacer {
  height: 40vh;
}
#dst-scrollytelling .dst-scroll-hint {
  display: block;
  margin-top: 0.9rem;
  color: ${BRAND_COLOR};
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: center;
}
#dst-scrollytelling .dst-scroll-hint::after {
  content: '';
  display: block;
  margin: 0.45rem auto 0;
  width: 7px;
  height: 7px;
  border-right: 2px solid ${BRAND_COLOR};
  border-bottom: 2px solid ${BRAND_COLOR};
  transform: rotate(45deg);
  animation: dst-arrow-bounce 2s ease-in-out infinite;
}
@keyframes dst-arrow-bounce {
  0%, 100% { transform: rotate(45deg) translate(0, 0); opacity: 1; }
  50%       { transform: rotate(45deg) translate(2px, 2px); opacity: 0.5; }
}
@media (max-width: 768px) {
  #dst-scrollytelling .dst-layout { flex-direction: column; }
  #dst-scrollytelling .dst-map-col {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    min-height: unset;
    position: sticky;
    top: 0;
  }
  #dst-scrollytelling .dst-text-col { width: 100%; }
  #dst-scrollytelling .dst-step {
    min-height: 180dvh;
    min-height: 180vh;
    padding: 1.25rem 1rem;
  }
  /* Intro-Card im unteren Drittel der Karte.
     Höhe 200dvh: erste 100dvh überlagern die Karte (margin-top: -100dvh),
     die restlichen 100dvh sind Scroll-Puffer. Step 0 triggert erst bei
     ca. 120dvh Scroll (= 200 - 80dvh Scrollama-Offset), die Intro-Card
     ist bei ca. 97dvh bereits aus dem Viewport → ~23dvh Puffer. */
  #dst-scrollytelling .dst-step.dst-step-intro {
    min-height: 200vh;
    min-height: 200dvh;
    margin-top: -100vh;
    margin-top: -100dvh;
    position: relative;
    z-index: 1;
    flex-direction: row;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: calc(103vh + 10px);
    padding-bottom: calc(103dvh + 10px);
  }
  #dst-scrollytelling .dst-spacer {
    height: 60dvh;
    height: 60vh;
  }
  #dst-scrollytelling .dst-step-card { max-width: 100%; }
}`;
    document.head.appendChild(style);
  }

  // ── DOM Construction ───────────────────────────────────────────────────────

  function buildDOM(container, mapDivId) {
    // Map column first (left), text column second (right)
    container.innerHTML =
      '<div class="dst-layout">' +
        '<div class="dst-map-col">' +
          '<div class="dst-map" id="' + mapDivId + '"></div>' +
        '</div>' +
        '<div class="dst-text-col">' +
          '<div class="dst-steps-wrap"></div>' +
          '<div class="dst-spacer"></div>' +
        '</div>' +
      '</div>';
  }

  // ── Step HTML Generation ───────────────────────────────────────────────────

  function buildSteps(container, features) {
    const wrap = container.querySelector('.dst-steps-wrap');

    const intro = document.createElement('div');
    intro.className = 'dst-step dst-step-intro is-active';
    intro.dataset.stepIndex = '-1';
    intro.innerHTML =
      '<div class="dst-step-card">' +
        '<h2 class="dst-step-title">Maritime Nadelöhre</h2>' +
        '<p class="dst-step-text">' +
          'Rund um den Globus gibt es sieben neuralgische Punkte für den Schiffsverkehr. Wenn es hier hakt, kommt schlimmstenfalls der Welthandel aus dem Takt.<br/><span class="dst-scroll-hint">Scrollen Sie weiter</span>' +
        '</p>' +
      '</div>';
    wrap.appendChild(intro);

    features.forEach(function (feature, i) {
      const name = escapeHtml(feature.properties.name || '');
      const info = infoToHtml(feature.properties.info || '');
      const step = document.createElement('div');
      step.className = 'dst-step';
      step.dataset.stepIndex = String(i);
      step.innerHTML =
        '<div class="dst-step-card">' +
          '<h2 class="dst-step-title">' + name + '</h2>' +
          '<p class="dst-step-text">' + info + '</p>' +
        '</div>';
      wrap.appendChild(step);
    });
  }

  // ── Map Helpers ────────────────────────────────────────────────────────────

  // Bbox als „Passkreuz“-Ecken (DTP: Schnittmarken): je Ecke ein L als eine
  // LineString (3 Punkte: Ende Schenkel → Ecke → Ende anderer Schenkel), damit
  // line-join an der Ecke keinen Butt-Cap-Schlitz zwischen zwei Segmenten hat.
  function bboxToPasskreuz(bboxStr, index) {
    const p = bboxStr.split(',').map(Number);
    if (p.length !== 4 || p.some(isNaN)) return null;
    const [a, b, c, d] = p;
    const we = Math.min(a, c);
    const ea = Math.max(a, c);
    const so = Math.min(b, d);
    const no = Math.max(b, d);
    const w = Math.abs(ea - we);
    const h = Math.abs(no - so);
    if (w < 1e-9 || h < 1e-9) return null;
    const L = Math.max(0.0001, Math.min(w, h) * 0.22);
    const lines = [
      [[we + L, so], [we, so], [we, so + L]],
      [[ea - L, so], [ea, so], [ea, so + L]],
      [[ea - L, no], [ea, no], [ea, no - L]],
      [[we + L, no], [we, no], [we, no - L]],
    ];
    return {
      type: 'Feature',
      properties: { index: index },
      geometry: { type: 'MultiLineString', coordinates: lines },
    };
  }

  function buildPasskreuzGeoJSON(features) {
    return {
      type: 'FeatureCollection',
      features: features
        .map(function (f) { return bboxToPasskreuz(f.properties.bbox || '', f.properties.index); })
        .filter(Boolean),
    };
  }

  // SW-Ecke jeder Bbox als Punkt – für das Label unten links im Polygon
  function buildBboxLabelGeoJSON(features) {
    return {
      type: 'FeatureCollection',
      features: features.map(function (f) {
        const p = (f.properties.bbox || '').split(',').map(Number);
        if (p.length !== 4 || p.some(isNaN)) return null;
        const west  = Math.min(p[0], p[2]);
        const south = Math.min(p[1], p[3]);
        return {
          type: 'Feature',
          properties: { name: f.properties.name, index: f.properties.index },
          geometry: { type: 'Point', coordinates: [west, south] },
        };
      }).filter(Boolean),
    };
  }

  // Parses bbox string and returns [[west,south],[east,north]] for map.fitBounds.
  function parseBboxBounds(bboxStr) {
    const p = bboxStr.split(',').map(Number);
    if (p.length !== 4 || p.some(isNaN)) return null;
    return [[p[0], p[1]], [p[2], p[3]]];
  }

  function setPasskreuzPaint(map, lineWidth, lineOpacity) {
    map.setPaintProperty('dst-passkreuz-line', 'line-width',   lineWidth);
    map.setPaintProperty('dst-passkreuz-line', 'line-opacity', lineOpacity);
  }

  function highlightMarker(map, activeIndex) {
    setPasskreuzPaint(map,
      ['case', ['==', ['get', 'index'], activeIndex], 3,    1.5],
      ['case', ['==', ['get', 'index'], activeIndex], 1,    0.4]
    );
  }

  function resetMarkers(map) {
    setPasskreuzPaint(map, PASSKREUZ_DEFAULT_WIDTH, PASSKREUZ_DEFAULT_OPACITY);
  }

  // ── Scrollama Init ─────────────────────────────────────────────────────────

  function isNarrowView() {
    return window.matchMedia(MOBILE_MQ).matches;
  }

  function initScrollama(map, features, container) {
    const scroller = scrollama();
    const steps = container.querySelectorAll('.dst-step'); // cached once
    let moveGen = 0;

    scroller
      .setup({
        step: '#' + ROOT_ID + ' .dst-step',
        offset: isNarrowView() ? SCROLL_OFFSET_MOBILE : SCROLL_OFFSET_DESKTOP,
        debug: false,
      })
      .onStepEnter(function (_ref) {
        const element = _ref.element;
        const idx = parseInt(element.dataset.stepIndex, 10);
        const narrow = isNarrowView();

        if (narrow) {
          moveGen += 1;
          const my = moveGen;
          steps.forEach(function (el) { el.classList.remove('is-active'); });
          resetMarkers(map);

          function applyActive() {
            if (my !== moveGen) return;
            if (idx !== -1) {
              highlightMarker(map, idx);
            }
            element.classList.add('is-active');
          }

          function whenCameraDone() {
            map.once('moveend', applyActive);
            const maxMs = (idx === -1 ? 1000 : FLY_DURATION) + 250;
            setTimeout(function () {
              if (my !== moveGen) return;
              if (element.classList.contains('is-active')) return;
              applyActive();
            }, maxMs);
          }

          if (idx === -1) {
            map.flyTo({ center: MAP_CENTER, zoom: MAP_ZOOM_MOBILE, duration: 1000, essential: true });
            whenCameraDone();
            return;
          }

          const feature = features[idx];
          const bounds  = parseBboxBounds(feature.properties.bbox || '');

          if (bounds) {
            map.fitBounds(bounds, { padding: 60, duration: FLY_DURATION, maxZoom: 10 });
          } else {
            map.flyTo({ center: feature.geometry.coordinates, zoom: 8, duration: FLY_DURATION, essential: true });
          }
          whenCameraDone();
          return;
        }

        // Desktop: Karten-Update und aktiver Step sofort
        steps.forEach(function (el) { el.classList.remove('is-active'); });
        element.classList.add('is-active');

        if (idx === -1) {
          map.flyTo({ center: MAP_CENTER, zoom: MAP_ZOOM, duration: 1000, essential: true });
          resetMarkers(map);
          return;
        }

        const feature = features[idx];
        const bounds  = parseBboxBounds(feature.properties.bbox || '');

        if (bounds) {
          map.fitBounds(bounds, { padding: 60, duration: FLY_DURATION, maxZoom: 10 });
        } else {
          map.flyTo({ center: feature.geometry.coordinates, zoom: 8, duration: FLY_DURATION, essential: true });
        }

        highlightMarker(map, idx);
      });

    window.addEventListener('resize', function () {
      scroller.offset(isNarrowView() ? SCROLL_OFFSET_MOBILE : SCROLL_OFFSET_DESKTOP);
      scroller.resize();
      map.resize();
    });
  }

  // ── Main ───────────────────────────────────────────────────────────────────

  async function main() {
    const container = document.getElementById(ROOT_ID);
    if (!container) {
      console.warn('[dst-scrollytelling] #' + ROOT_ID + ' not found.');
      return;
    }

    injectStyles();

    const mapDivId = ROOT_ID + '-map-' + Math.random().toString(36).slice(2, 8);
    buildDOM(container, mapDivId);

    loadCSS(ML_CSS_URL);
    try {
      await Promise.all([
        loadScript(ML_JS_URL,   'maplibregl'),
        loadScript(SCRL_JS_URL, 'scrollama'),
      ]);
    } catch (err) {
      console.error('[dst-scrollytelling] Dependency load failed:', err);
      return;
    }

    const map = new maplibregl.Map({
      container:  mapDivId,
      style:      MAP_STYLE,
      center:     MAP_CENTER,
      zoom:       isNarrowView() ? MAP_ZOOM_MOBILE : MAP_ZOOM,
      bearing:    0,
      pitch:      0,
      scrollZoom: false,
    });

    map.on('load', async function () {
      // Kartenbeschriftung auf Deutsch umstellen (name:de, Fallback: name)
      map.getStyle().layers.forEach(function (layer) {
        if (layer.layout && layer.layout['text-field'] !== undefined) {
          map.setLayoutProperty(layer.id, 'text-field', [
            'coalesce', ['get', 'name:de'], ['get', 'name'],
          ]);
        }
      });

      let geojson;
      try {
        const res = await fetch(GEOJSON_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        geojson = await res.json();
      } catch (err) {
        console.error('[dst-scrollytelling] GeoJSON fetch failed:', err);
        return;
      }

      const features = geojson.features;

      // Pulsierender Dot: animiertes Canvas-Image für MapLibre
      // BRAND_COLOR #0a94c2 → RGB(10, 148, 194)
      const PULSE_SIZE = 120;
      const PULSE_DURATION = 2400; // ms – langsamer Puls
      const pulsingDot = {
        width:  PULSE_SIZE,
        height: PULSE_SIZE,
        data:   new Uint8Array(PULSE_SIZE * PULSE_SIZE * 4),

        onAdd: function () {
          const canvas = document.createElement('canvas');
          canvas.width  = this.width;
          canvas.height = this.height;
          this.context  = canvas.getContext('2d');
        },

        render: function () {
          const t   = (performance.now() % PULSE_DURATION) / PULSE_DURATION;
          const cx  = this.width  / 2;
          const cy  = this.height / 2;
          const innerR    = 16;
          const maxOuterR = cx - 2;
          const outerR    = innerR + (maxOuterR - innerR) * t;
          const ctx = this.context;

          ctx.clearRect(0, 0, this.width, this.height);

          // Äußerer Pulsring (fades out while expanding)
          ctx.beginPath();
          ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(10,148,194,' + (0.45 * (1 - t)) + ')';
          ctx.fill();

          // Innerer Kreis (solid BRAND_COLOR mit weißem Rand)
          ctx.beginPath();
          ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
          ctx.fillStyle   = BRAND_COLOR;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth   = 2.5;
          ctx.fill();
          ctx.stroke();

          this.data = ctx.getImageData(0, 0, this.width, this.height).data;
          map.triggerRepaint();
          return true;
        },
      };
      map.addImage('dst-pulsing-dot', pulsingDot, { pixelRatio: 2 });

      // Point source — used for labels and pulsing dots
      map.addSource('dst-points', { type: 'geojson', data: geojson });

      // Bbox → Schnittmarken-Ecken (Passkreuz-Optik)
      map.addSource('dst-passkreuz', { type: 'geojson', data: buildPasskreuzGeoJSON(features) });

      // NW-Ecken der Bboxen als Label-Ankerpunkte
      map.addSource('dst-bbox-labels', { type: 'geojson', data: buildBboxLabelGeoJSON(features) });

      // Passkreuz: bei Start-Zoom unsichtbar, blendet erst beim Heranzoomen ein
      map.addLayer({
        id:     'dst-passkreuz-line',
        type:   'line',
        source: 'dst-passkreuz',
        paint: {
          'line-color':   BRAND_COLOR,
          'line-width':   PASSKREUZ_DEFAULT_WIDTH,
          'line-opacity': PASSKREUZ_DEFAULT_OPACITY,
        },
        layout: {
          'line-cap':  'butt',
          'line-join': 'miter',
        },
      });

      // Nummerierte Pulsing-Dots: nur im Start-Zoom sichtbar, blenden beim Heranzoomen aus
      map.addLayer({
        id:     'dst-pulsing-dots',
        type:   'symbol',
        source: 'dst-points',
        layout: {
          'icon-image':         'dst-pulsing-dot',
          'icon-allow-overlap': true,
          'icon-anchor':        'center',
          'text-field':         ['to-string', ['+', ['get', 'index'], 1]],
          'text-size':          11,
          'text-font':          ['Noto Sans Bold'],
          'text-anchor':        'center',
          'text-allow-overlap': true,
        },
        paint: {
          'icon-opacity': DOT_ZOOM_OPACITY,
          'text-color':   '#ffffff',
          'text-opacity': DOT_ZOOM_OPACITY,
        },
      });

      // Ortsname-Labels: oben links in der Bbox, Versalien, BRAND_COLOR – beim Start-Zoom unsichtbar
      map.addLayer({
        id:     'dst-labels',
        type:   'symbol',
        source: 'dst-bbox-labels',
        layout: {
          'text-field':     ['get', 'name'],
          'text-size':      13,
          'text-anchor':    'bottom-left',
          'text-offset':    [0.8, -0.8],
          'text-max-width': 120,
          'text-font':      ['Noto Sans Bold'],
          'text-transform': 'uppercase',
        },
        paint: {
          'text-color':      BRAND_COLOR,
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
          'text-opacity':    ['interpolate', ['linear'], ['zoom'], ZOOM_FADE_START, 0, ZOOM_FADE_END, 1],
        },
      });

      buildSteps(container, features);
      initScrollama(map, features, container);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
