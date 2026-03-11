(function () {
  'use strict';

  var countries = {};
  var fromSelect = document.getElementById('from-country');
  var toSelect = document.getElementById('to-country');
  var resultSection = document.getElementById('result-section');
  var resultTitle = document.getElementById('result-title');
  var resultPlugFromLabel = document.getElementById('result-plug-from-label');
  var resultPlugFromIcons = document.getElementById('result-plug-from-icons');
  var resultPlugToLabel = document.getElementById('result-plug-to-label');
  var resultPlugToIcons = document.getElementById('result-plug-to-icons');
  var resultShared = document.getElementById('result-shared');
  var resultCompat = document.getElementById('result-compat');
  var resultVoltageLine = document.getElementById('result-voltage-line');
  var resultVoltageExplanation = document.getElementById('result-voltage-explanation');
  var resultGuideLinkWrap = document.getElementById('result-guide-link-wrap');
  var resultGuideLink = document.getElementById('result-guide-link');

  function loadCountries(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'data/countries.json', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          countries = JSON.parse(xhr.responseText);
          callback();
        } catch (e) {
          console.error('Failed to parse countries.json', e);
        }
      }
    };
    xhr.send();
  }

  function fillSelects() {
    var keys = Object.keys(countries).sort(function (a, b) {
      return countries[a].name.localeCompare(countries[b].name);
    });
    var opt;
    keys.forEach(function (key) {
      opt = document.createElement('option');
      opt.value = key;
      opt.textContent = countries[key].name;
      fromSelect.appendChild(opt.cloneNode(true));
      toSelect.appendChild(opt);
    });
  }

  function renderPlugIcons(plugTypes) {
    if (!plugTypes || plugTypes.length === 0) return '';
    return plugTypes.map(function (type) {
      var letter = type.toLowerCase();
      return '<div class="plug-icon"><img src="/images/type-' + letter + '.svg" alt="Plug type ' + type + '"><span>Type ' + type + '</span></div>';
    }).join('');
  }

  function findSharedPlugs(a, b) {
    if (!a || !b) return [];
    return a.filter(function (type) { return b.indexOf(type) !== -1; });
  }

  function hasSharedPlugType(typesA, typesB) {
    return findSharedPlugs(typesA || [], typesB || []).length > 0;
  }

  function voltageMessage(v1, v2) {
    var a = Number(v1, 10);
    var b = Number(v2, 10);
    if (a === b) {
      return 'Voltage is the same. Your devices should work normally.';
    }
    var max = Math.max(a, b);
    if (max === 0) return '';
    var diff = Math.abs(a - b) / max;
    if (diff <= 0.20) {
      return 'Voltage difference is small (less than about 20%). Most modern electronics will work safely, but charging times may vary.';
    }
    return 'Voltage difference is significant. A voltage converter may be required for devices that are not dual-voltage.';
  }

  function updateResult() {
    var fromKey = fromSelect.value;
    var toKey = toSelect.value;
    if (!fromKey || !toKey) {
      resultSection.hidden = true;
      return;
    }

    var from = countries[fromKey];
    var to = countries[toKey];
    if (!from || !to) {
      resultSection.hidden = true;
      return;
    }

    var plugCompat = hasSharedPlugType(from.plug_types, to.plug_types);
    var shared = findSharedPlugs(from.plug_types || [], to.plug_types || []);
    var voltageMsg = voltageMessage(from.voltage, to.voltage);

    resultTitle.textContent = from.name + ' \u2192 ' + to.name;

    resultPlugFromLabel.textContent = from.name + ' plugs';
    resultPlugFromIcons.innerHTML = renderPlugIcons(from.plug_types);

    resultPlugToLabel.textContent = to.name + ' plugs';
    resultPlugToIcons.innerHTML = renderPlugIcons(to.plug_types);

    if (shared.length > 0) {
      resultShared.textContent = 'Shared plug type' + (shared.length > 1 ? 's: ' : ': ') + shared.join(', ');
      resultShared.className = 'result-shared result-shared-yes';
    } else {
      resultShared.textContent = 'No shared plug types. A travel adapter is required.';
      resultShared.className = 'result-shared result-shared-no';
    }

    resultCompat.textContent = 'Compatibility: ' + (plugCompat ? 'Compatible' : 'Adapter Required');
    resultCompat.className = 'result-compat ' + (plugCompat ? 'compatible' : 'adapter-required');

    resultVoltageLine.textContent = 'Voltage — ' + from.name + ' ' + (from.voltage != null ? from.voltage + 'V' : '—') + ' \u2014 ' + to.name + ' ' + (to.voltage != null ? to.voltage + 'V' : '—');
    resultVoltageExplanation.textContent = voltageMsg;

    if (fromKey !== toKey) {
      var slug = fromKey + '-to-' + toKey;
      var guideHref = '/pages/compatibility/' + slug + '.html';
      resultGuideLink.href = guideHref;
      resultGuideLink.textContent = 'View Full Travel Adapter Guide — ' + from.name + ' \u2192 ' + to.name;
      resultGuideLinkWrap.hidden = false;
    } else {
      resultGuideLinkWrap.hidden = true;
    }

    resultSection.hidden = false;
  }

  function init() {
    loadCountries(function () {
      fillSelects();
      fromSelect.addEventListener('change', updateResult);
      toSelect.addEventListener('change', updateResult);
      updateResult();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
