(function () {
  'use strict';

  // Capture base URL synchronously — document.currentScript is only valid during
  // synchronous script evaluation, before any async operations.
  const _script = document.currentScript;
  const _base = _script ? _script.src.replace(/\/[^/]*$/, '/') : '';

  const GEOJSON_URL   = _base + 'data/data.geojson';
  const ML_CSS_URL    = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css';
  const ML_JS_URL     = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js';
  const SCRL_JS_URL   = 'https://unpkg.com/scrollama@3/build/scrollama.min.js';
  const MAP_STYLE     = 'https://tiles.openfreemap.org/styles/positron';
  const CSS_TAG_ID    = 'dst-scrollytelling-styles';
  const ROOT_ID       = 'dst-scrollytelling';
  const ACTIVE_COLOR  = '#e63946';
  const INACT_COLOR   = '#6c757d';
  const ACTIVE_RADIUS = 10;
  const INACT_RADIUS  = 6;
  const FLY_DURATION  = 1400;

  // ── Utilities ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Converts \n line-breaks in GeoJSON info text to <br> for HTML display.
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
    if (document.getElementById(CSS_TAG_ID)) return; // idempotent
    const style = document.createElement('style');
    style.id = CSS_TAG_ID;
    style.textContent = [
      '#dst-scrollytelling {',
      '  box-sizing: border-box;',
      '  font-family: Georgia, "Times New Roman", serif;',
      '  line-height: 1.55;',
      '  color: #222;',
      '  background: #fff;',
      '}',
      '#dst-scrollytelling *, #dst-scrollytelling *::before, #dst-scrollytelling *::after {',
      '  box-sizing: inherit;',
      '}',
      // Layout wrapper
      '#dst-scrollytelling .dst-layout {',
      '  display: flex;',
      '  flex-direction: row;',
      '  align-items: flex-start;',
      '  width: 100%;',
      '  position: relative;',
      '}',
      // Text column (left, 40%)
      '#dst-scrollytelling .dst-text-col {',
      '  width: 40%;',
      '  position: relative;',
      '  z-index: 2;',
      '}',
      // Map column (right, 60%, sticky)
      '#dst-scrollytelling .dst-map-col {',
      '  width: 60%;',
      '  position: sticky;',
      '  top: 0;',
      '  height: 100vh;',
      '  z-index: 1;',
      '}',
      '#dst-scrollytelling .dst-map {',
      '  width: 100%;',
      '  height: 100%;',
      '}',
      // Individual scroll steps
      '#dst-scrollytelling .dst-step {',
      '  min-height: 80vh;',
      '  display: flex;',
      '  align-items: center;',
      '  padding: 2rem 1.5rem;',
      '}',
      '#dst-scrollytelling .dst-step-intro {',
      '  min-height: 60vh;',
      '}',
      '#dst-scrollytelling .dst-step-card {',
      '  background: rgba(255, 255, 255, 0.95);',
      '  border-left: 4px solid #ccc;',
      '  padding: 1.25rem 1.25rem 1.25rem 1rem;',
      '  border-radius: 2px;',
      '  box-shadow: 0 1px 4px rgba(0,0,0,0.12);',
      '  transition: border-color 0.3s ease;',
      '  max-width: 340px;',
      '}',
      '#dst-scrollytelling .dst-step.is-active .dst-step-card {',
      '  border-left-color: ' + ACTIVE_COLOR + ';',
      '}',
      '#dst-scrollytelling .dst-step-title {',
      '  margin: 0 0 0.6rem 0;',
      '  font-size: 1rem;',
      '  font-weight: 700;',
      '  line-height: 1.3;',
      '  color: #111;',
      '  white-space: pre-line;',
      '}',
      '#dst-scrollytelling .dst-step-text {',
      '  margin: 0;',
      '  font-size: 0.85rem;',
      '  line-height: 1.6;',
      '  color: #333;',
      '}',
      // Spacer at bottom so last step can scroll fully into view
      '#dst-scrollytelling .dst-spacer {',
      '  height: 40vh;',
      '}',
      // Mobile: stacked (map top sticky, text below)
      '@media (max-width: 768px) {',
      '  #dst-scrollytelling .dst-layout { flex-direction: column; }',
      '  #dst-scrollytelling .dst-map-col {',
      '    width: 100%;',
      '    height: 60vw;',
      '    min-height: 260px;',
      '    position: sticky;',
      '    top: 0;',
      '  }',
      '  #dst-scrollytelling .dst-text-col { width: 100%; }',
      '  #dst-scrollytelling .dst-step { padding: 1.25rem 1rem; }',
      '  #dst-scrollytelling .dst-step-card { max-width: 100%; }',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── DOM Construction ───────────────────────────────────────────────────────

  function buildDOM(container, mapDivId) {
    container.innerHTML =
      '<div class="dst-layout">' +
        '<div class="dst-text-col">' +
          '<div class="dst-steps-wrap"></div>' +
          '<div class="dst-spacer"></div>' +
        '</div>' +
        '<div class="dst-map-col">' +
          '<div class="dst-map" id="' + mapDivId + '"></div>' +
        '</div>' +
      '</div>';
  }

  // ── Step HTML Generation ───────────────────────────────────────────────────

  function buildSteps(container, features) {
    const wrap = container.querySelector('.dst-steps-wrap');

    // Intro step — overview, not tied to a specific feature
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

  function fitAllFeatures(map, features) {
    if (!features.length) return;
    const coords = features.map(function (f) { return f.geometry.coordinates; });
    const bounds = coords.reduce(function (b, c) {
      return b.extend(c);
    }, new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(bounds, { padding: 80, duration: 1000, maxZoom: 6 });
  }

  function highlightMarker(map, activeIndex) {
    const radiusExpr = ['case', ['==', ['get', 'index'], activeIndex], ACTIVE_RADIUS, INACT_RADIUS];
    const colorExpr  = ['case', ['==', ['get', 'index'], activeIndex], ACTIVE_COLOR,  INACT_COLOR];
    map.setPaintProperty('dst-circles', 'circle-radius', radiusExpr);
    map.setPaintProperty('dst-circles', 'circle-color',  colorExpr);
  }

  function resetMarkers(map) {
    map.setPaintProperty('dst-circles', 'circle-radius', INACT_RADIUS);
    map.setPaintProperty('dst-circles', 'circle-color',  INACT_COLOR);
  }

  // ── Scrollama Init ─────────────────────────────────────────────────────────

  function initScrollama(map, features, container) {
    const scroller = scrollama();

    scroller
      .setup({
        step: '#' + ROOT_ID + ' .dst-step',
        offset: 0.5,
        debug: false,
      })
      .onStepEnter(function (_ref) {
        const element = _ref.element;

        container.querySelectorAll('.dst-step').forEach(function (el) {
          el.classList.remove('is-active');
        });
        element.classList.add('is-active');

        const idx = parseInt(element.dataset.stepIndex, 10);

        if (idx === -1) {
          fitAllFeatures(map, features);
          resetMarkers(map);
          return;
        }

        const feature = features[idx];
        const coords  = feature.geometry.coordinates;
        const props   = feature.properties;

        map.flyTo({
          center:   coords,
          zoom:     props.zoom    != null ? props.zoom    : 8,
          bearing:  props.bearing != null ? props.bearing : 0,
          pitch:    props.pitch   != null ? props.pitch   : 0,
          duration: FLY_DURATION,
          essential: true,
        });

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

    // Unique map div ID so multiple maps on a page don't collide.
    const mapDivId = ROOT_ID + '-map-' + Math.random().toString(36).slice(2, 8);
    buildDOM(container, mapDivId);

    // Load MapLibre CSS (non-blocking) then JS + Scrollama in parallel.
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
      container: mapDivId,
      style:     MAP_STYLE,
      center:    [37.6, 21.6], // Red Sea overview
      zoom:      3.5,
      bearing:   0,
      pitch:     0,
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

      map.addSource('dst-points', {
        type: 'geojson',
        data: geojson,
      });

      // Pulsing circle markers for all locations
      map.addLayer({
        id:     'dst-circles',
        type:   'circle',
        source: 'dst-points',
        paint: {
          'circle-radius':       INACT_RADIUS,
          'circle-color':        INACT_COLOR,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Location name labels
      map.addLayer({
        id:     'dst-labels',
        type:   'symbol',
        source: 'dst-points',
        layout: {
          'text-field':  ['get', 'name'],
          'text-size':   11,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-font':   ['Noto Sans Regular'],
        },
        paint: {
          'text-color':       '#111',
          'text-halo-color':  '#ffffff',
          'text-halo-width':  1.5,
        },
      });

      buildSteps(container, features);
      fitAllFeatures(map, features);
      initScrollama(map, features, container);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
