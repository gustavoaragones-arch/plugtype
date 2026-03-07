(function () {
  'use strict';

  var countries = {};
  var fromSelect = document.getElementById('from-country');
  var toSelect = document.getElementById('to-country');
  var resultSection = document.getElementById('result-section');
  var resultTitle = document.getElementById('result-title');
  var resultPlugFrom = document.getElementById('result-plug-from');
  var resultPlugTo = document.getElementById('result-plug-to');
  var resultCompat = document.getElementById('result-compat');
  var resultVoltage = document.getElementById('result-voltage');
  var resultWarning = document.getElementById('result-warning');

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

  function hasSharedPlugType(typesA, typesB) {
    var i, j;
    for (i = 0; i < typesA.length; i++) {
      for (j = 0; j < typesB.length; j++) {
        if (typesA[i] === typesB[j]) return true;
      }
    }
    return false;
  }

  function voltageDiffPercent(v1, v2) {
    var max = Math.max(v1, v2);
    var min = Math.min(v1, v2);
    if (min === 0) return 0;
    return ((max - min) / min) * 100;
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
    var voltagePct = voltageDiffPercent(from.voltage, to.voltage);
    var needVoltageWarning = voltagePct > 20;

    resultTitle.textContent = from.name + ' \u2192 ' + to.name;
    resultPlugFrom.textContent = from.name + ': ' + (from.plug_types.join(' ') || '');
    resultPlugTo.textContent = to.name + ': ' + (to.plug_types.join(' ') || '');
    resultCompat.textContent = 'Compatibility: ' + (plugCompat ? 'Compatible' : 'Adapter Required');
    resultCompat.className = 'result-compat ' + (plugCompat ? 'compatible' : 'adapter-required');
    resultVoltage.textContent = 'Voltage: ' + from.name + ' ' + from.voltage + 'V \u2014 ' + to.name + ' ' + to.voltage + 'V';

    if (needVoltageWarning) {
      resultWarning.textContent = 'Voltage converter recommended';
      resultWarning.hidden = false;
    } else {
      resultWarning.hidden = true;
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
