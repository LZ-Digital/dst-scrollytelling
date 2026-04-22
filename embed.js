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
  const MAP_CENTER   = [0, 20];
  const MAP_ZOOM     = 1;
  const CSS_TAG_ID   = 'dst-scrollytelling-styles';
  const ROOT_ID      = 'dst-scrollytelling';
  const BRAND_COLOR  = '#086f91';
  const FLY_DURATION = 1400;
  // Must match the mobile @media in injectStyles
  const MOBILE_MQ = '(max-width: 768px)';
  // Scrollama: höherer Wert = Step wird erst „entered“, wenn stärker gescrollt (vorheriger Step eher weg).
  const SCROLL_OFFSET_DESKTOP   = 0.5;
  const SCROLL_OFFSET_MOBILE   = 0.8;

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
    min-height: 210dvh;
    min-height: 210vh;
    padding: 1.25rem 1rem;
  }
  /* Intro über der Kartenfläche, Karte in der Vollbild-Fläche zentriert */
  #dst-scrollytelling .dst-step.dst-step-intro {
    min-height: 100vh;
    min-height: 100dvh;
    margin-top: -100vh;
    margin-top: -100dvh;
    position: relative;
    z-index: 1;
    flex-direction: row;
    align-items: center;
    justify-content: center;
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
        '<h2 class="dst-step-title">Kritische Engstellen</h2>' +
        '<p class="dst-step-text">' +
          'Rund um den Globus gibt es sieben maritime Nadelöhre für die Containerschifffahrt. Jede Störung hier wirkt sich direkt auf den Welthandel aus.' +
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

  // Parses a "west,south,east,north" bbox string into a GeoJSON Polygon.
  function bboxToPolygon(bboxStr, index) {
    const p = bboxStr.split(',').map(Number);
    if (p.length !== 4 || p.some(isNaN)) return null;
    const [west, south, east, north] = p;
    return {
      type: 'Feature',
      properties: { index: index },
      geometry: {
        type: 'Polygon',
        coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
      },
    };
  }

  function buildBoxGeoJSON(features) {
    return {
      type: 'FeatureCollection',
      features: features
        .map(function (f) { return bboxToPolygon(f.properties.bbox || '', f.properties.index); })
        .filter(Boolean),
    };
  }

  // Parses bbox string and returns [[west,south],[east,north]] for map.fitBounds.
  function parseBboxBounds(bboxStr) {
    const p = bboxStr.split(',').map(Number);
    if (p.length !== 4 || p.some(isNaN)) return null;
    return [[p[0], p[1]], [p[2], p[3]]];
  }

  function setBoxPaint(map, lineWidth, lineOpacity, fillOpacity) {
    map.setPaintProperty('dst-box-line', 'line-width',   lineWidth);
    map.setPaintProperty('dst-box-line', 'line-opacity', lineOpacity);
    map.setPaintProperty('dst-box-fill', 'fill-opacity', fillOpacity);
  }

  function highlightMarker(map, activeIndex) {
    setBoxPaint(map,
      ['case', ['==', ['get', 'index'], activeIndex], 3,    1.5],
      ['case', ['==', ['get', 'index'], activeIndex], 1,    0.4],
      ['case', ['==', ['get', 'index'], activeIndex], 0.12, 0.04]
    );
  }

  function resetMarkers(map) {
    setBoxPaint(map, 1.5, 0.4, 0.04);
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
            map.flyTo({ center: MAP_CENTER, zoom: MAP_ZOOM, duration: 1000, essential: true });
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
      zoom:       MAP_ZOOM,
      bearing:    0,
      pitch:      0,
      scrollZoom: false,
    });

    map.on('load', async function () {
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

      // Point source — used only for name labels
      map.addSource('dst-points', { type: 'geojson', data: geojson });

      // Polygon source — bbox rectangles per feature
      map.addSource('dst-boxes', { type: 'geojson', data: buildBoxGeoJSON(features) });

      // Box fill (semi-transparent)
      map.addLayer({
        id:     'dst-box-fill',
        type:   'fill',
        source: 'dst-boxes',
        paint: {
          'fill-color':   BRAND_COLOR,
          'fill-opacity': 0.04,
        },
      });

      // Box outline
      map.addLayer({
        id:     'dst-box-line',
        type:   'line',
        source: 'dst-boxes',
        paint: {
          'line-color':   BRAND_COLOR,
          'line-width':   1.5,
          'line-opacity': 0.4,
        },
      });

      // Location name labels (above boxes)
      map.addLayer({
        id:     'dst-labels',
        type:   'symbol',
        source: 'dst-points',
        layout: {
          'text-field':  ['get', 'name'],
          'text-size':   11,
          'text-offset': [0, 0],
          'text-anchor': 'center',
          'text-font':   ['Noto Sans Regular'],
        },
        paint: {
          'text-color':      '#111',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
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
