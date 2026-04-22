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

  // ── Utilities ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // escapeHtml first, then restore breaks — no raw user HTML is injected.
  function infoToHtml(str) {
    return escapeHtml(str).replace(/\n/g, '<br>');
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
  top: 0;
  height: 100vh;
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
  min-height: 80vh;
  display: flex;
  align-items: center;
  padding: 2rem 1.5rem;
}
#dst-scrollytelling .dst-step-intro {
  min-height: 60vh;
}
#dst-scrollytelling .dst-step-card {
  background: rgba(255, 255, 255, 0.95);
  border-left: 4px solid #ccc;
  padding: 1.25rem 1.25rem 1.25rem 1rem;
  border-radius: 2px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  transition: border-color 0.3s ease;
  max-width: 340px;
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
#dst-scrollytelling .dst-spacer {
  height: 40vh;
}
@media (max-width: 768px) {
  #dst-scrollytelling .dst-layout { flex-direction: column; }
  #dst-scrollytelling .dst-map-col {
    width: 100%;
    height: 60vw;
    min-height: 260px;
    position: sticky;
    top: 0;
  }
  #dst-scrollytelling .dst-text-col { width: 100%; }
  #dst-scrollytelling .dst-step { padding: 1.25rem 1rem; }
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
        '<h2 class="dst-step-title">Kritische Meerengen</h2>' +
        '<p class="dst-step-text">' +
          'Zwei Wasserstra&szlig;en, durch die ein gro&szlig;er Teil des Welthandels flie&szlig;t &ndash; ' +
          'und die Deutschland direkt betreffen. Scrollen Sie, um mehr zu erfahren.' +
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

  function initScrollama(map, features, container) {
    const scroller = scrollama();
    const steps = container.querySelectorAll('.dst-step'); // cached once

    scroller
      .setup({
        step: '#' + ROOT_ID + ' .dst-step',
        offset: 0.5,
        debug: false,
      })
      .onStepEnter(function (_ref) {
        const element = _ref.element;

        steps.forEach(function (el) { el.classList.remove('is-active'); });
        element.classList.add('is-active');

        const idx = parseInt(element.dataset.stepIndex, 10);

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
