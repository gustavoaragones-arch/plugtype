(function () {
  'use strict';

  var container = document.getElementById('world-map-container');
  var zoomLayer = document.getElementById('world-map-zoom-layer');
  var tooltip = document.getElementById('map-tooltip');
  var zoomInBtn = document.getElementById('map-zoom-in');
  var zoomOutBtn = document.getElementById('map-zoom-out');
  if (!container || !tooltip) return;

  var countries = {};
  var zoomLevel = 1;
  var ZOOM_MIN = 1;
  var ZOOM_MAX = 3;
  var ZOOM_STEP = 0.25;
  var panX = 0;
  var panY = 0;
  var suppressClickUntil = 0;
  var dragAccum = 0;
  var isDraggingMap = false;
  var dragPointerId = null;
  var lastPointerX = 0;
  var lastPointerY = 0;

  function updateZoomedClass() {
    if (!container) return;
    if (zoomLevel > 1.001) {
      container.classList.add('world-map-container--zoomed');
    } else {
      container.classList.remove('world-map-container--zoomed');
    }
  }

  function clampPan() {
    if (!container || !zoomLayer) return;
    var vw = container.clientWidth;
    var vh = container.clientHeight;
    var cw = zoomLayer.offsetWidth;
    var ch = zoomLayer.offsetHeight;
    var minX = Math.min(0, vw - cw);
    var maxX = 0;
    var minY = Math.min(0, vh - ch);
    var maxY = 0;
    panX = Math.max(minX, Math.min(maxX, panX));
    panY = Math.max(minY, Math.min(maxY, panY));
    if (zoomLevel <= 1.001) {
      panX = 0;
      panY = 0;
    }
  }

  function applyMapTransform() {
    if (!zoomLayer) return;
    var pct = 100 * zoomLevel;
    zoomLayer.style.width = pct + '%';
    zoomLayer.style.minWidth = pct + '%';
    zoomLayer.style.transform = 'translate(' + panX + 'px,' + panY + 'px)';
    var svg = zoomLayer.querySelector('.world-map-svg');
    if (svg) {
      svg.style.width = '100%';
      svg.style.maxWidth = 'none';
    }
    if (zoomInBtn) zoomInBtn.disabled = zoomLevel >= ZOOM_MAX - 0.001;
    if (zoomOutBtn) zoomOutBtn.disabled = zoomLevel <= ZOOM_MIN + 0.001;
    updateZoomedClass();
  }

  function applyMapZoom() {
    clampPan();
    applyMapTransform();
    requestAnimationFrame(function () {
      clampPan();
      applyMapTransform();
    });
  }

  function initMapPan() {
    if (!container || !zoomLayer) return;

    function onPointerDown(e) {
      if (zoomLevel <= 1.001) return;
      if (e.button != null && e.button !== 0) return;
      isDraggingMap = true;
      dragPointerId = e.pointerId;
      dragAccum = 0;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      container.classList.add('is-dragging-map');
      try {
        container.setPointerCapture(e.pointerId);
      } catch (err) { /* ignore */ }
    }

    function onPointerMove(e) {
      if (!isDraggingMap || e.pointerId !== dragPointerId) return;
      var dx = e.clientX - lastPointerX;
      var dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      dragAccum += Math.abs(dx) + Math.abs(dy);
      panX += dx;
      panY += dy;
      clampPan();
      zoomLayer.style.transform = 'translate(' + panX + 'px,' + panY + 'px)';
    }

    function endDrag(e) {
      if (!isDraggingMap || (e && e.pointerId !== dragPointerId)) return;
      isDraggingMap = false;
      dragPointerId = null;
      container.classList.remove('is-dragging-map');
      try {
        if (e) container.releasePointerCapture(e.pointerId);
      } catch (err) { /* ignore */ }
      if (dragAccum > 6) {
        suppressClickUntil = Date.now() + 400;
      }
    }

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', endDrag);
    container.addEventListener('pointercancel', endDrag);
    container.addEventListener('lostpointercapture', function (e) {
      if (e.pointerId === dragPointerId) endDrag(e);
    });

    window.addEventListener('resize', function () {
      clampPan();
      applyMapTransform();
    });
  }

  function initZoomControls() {
    if (!zoomLayer || !zoomInBtn || !zoomOutBtn) return;
    zoomInBtn.addEventListener('click', function () {
      zoomLevel = Math.min(ZOOM_MAX, Math.round((zoomLevel + ZOOM_STEP) * 100) / 100);
      applyMapZoom();
    });
    zoomOutBtn.addEventListener('click', function () {
      zoomLevel = Math.max(ZOOM_MIN, Math.round((zoomLevel - ZOOM_STEP) * 100) / 100);
      applyMapZoom();
    });
    applyMapZoom();
    initMapPan();
  }

  function loadCountries(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'data/countries.json', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          countries = JSON.parse(xhr.responseText);
          callback();
        } catch (e) {
          console.error('map: failed to parse countries.json', e);
        }
      }
    };
    xhr.send();
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function showTooltip(data, clientX, clientY) {
    var plugs = (data.plug_types && data.plug_types.length) ? data.plug_types.join(', ') : '—';
    var v = data.voltage != null ? data.voltage + 'V' : '—';
    tooltip.innerHTML =
      '<strong>' + escapeHtml(data.name) + '</strong><br>' +
      'Plug types: ' + escapeHtml(plugs) + '<br>' +
      'Voltage: ' + escapeHtml(v);
    tooltip.style.display = 'block';
    tooltip.style.left = clientX + 12 + 'px';
    tooltip.style.top = clientY + 12 + 'px';
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
    tooltip.textContent = '';
  }

  function injectSvg(svgText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(svgText, 'image/svg+xml');
    var svg = doc.querySelector('svg');
    if (!svg) return;
    svg.setAttribute('class', 'world-map-svg');
    svg.setAttribute('focusable', 'false');
    var mount = zoomLayer || container;
    mount.appendChild(svg);
    initZoomControls();

    var paths = svg.querySelectorAll('path[id]');
    paths.forEach(function (pathEl) {
      var id = pathEl.getAttribute('id');
      var data = countries[id];
      if (!data) return;

      pathEl.setAttribute('tabindex', '0');
      pathEl.setAttribute('role', 'button');
      pathEl.setAttribute('aria-label', data.name + ' — plug types and voltage');

      pathEl.addEventListener('mouseenter', function (e) {
        showTooltip(data, e.clientX, e.clientY);
      });
      pathEl.addEventListener('mousemove', function (e) {
        if (tooltip.style.display === 'block') {
          tooltip.style.left = e.clientX + 12 + 'px';
          tooltip.style.top = e.clientY + 12 + 'px';
        }
      });
      pathEl.addEventListener('mouseleave', hideTooltip);

      pathEl.addEventListener('click', function (e) {
        if (Date.now() < suppressClickUntil) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        window.location.href = '/pages/countries/' + id + '.html';
      });
      pathEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.location.href = '/pages/countries/' + id + '.html';
        }
      });
    });
  }

  loadCountries(function () {
    fetch('/images/world-map.svg')
      .then(function (r) {
        if (!r.ok) throw new Error('map svg ' + r.status);
        return r.text();
      })
      .then(injectSvg)
      .catch(function (err) {
        console.error('map: could not load world-map.svg', err);
        var controls = document.querySelector('.world-map-zoom-controls');
        if (controls) controls.hidden = true;
        if (zoomLayer) zoomLayer.innerHTML = '<p class="world-map-fallback">Map could not be loaded.</p>';
        else container.innerHTML = '<p class="world-map-fallback">Map could not be loaded.</p>';
      });
  });
})();
