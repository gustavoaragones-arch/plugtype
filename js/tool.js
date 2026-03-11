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
  var resultDeviceAdviceText = document.getElementById('result-device-advice-text');

  var selectedDevice = 'phone';

  var deviceProfiles = {
    phone: { dualVoltage: true, category: 'electronics' },
    laptop: { dualVoltage: true, category: 'electronics' },
    camera: { dualVoltage: true, category: 'electronics' },
    cpap: { dualVoltage: 'depends', category: 'medical' },
    hairdryer: { dualVoltage: false, category: 'heating' },
    shaver: { dualVoltage: 'sometimes', category: 'grooming' }
  };

  var deviceLabels = {
    phone: 'Phone',
    laptop: 'Laptop',
    camera: 'Camera',
    cpap: 'CPAP Machine',
    hairdryer: 'Hair Dryer',
    shaver: 'Electric Shaver'
  };

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

  function detectVisitorCountry() {
    return fetch('https://ipapi.co/json/')
      .then(function (response) { return response.json(); })
      .then(function (data) { return data.country_name || null; })
      .catch(function () {
        console.log('Geolocation failed');
        return null;
      });
  }

  function findCountryKeyByName(countryName, countriesData) {
    if (!countryName || !countriesData) return null;
    for (var key in countriesData) {
      if (countriesData[key].name === countryName) return key;
    }
    return null;
  }

  function autoSelectOriginCountry(countriesData, updateResultFn) {
    detectVisitorCountry().then(function (detectedCountry) {
      if (!detectedCountry) return;
      if (fromSelect.value !== '') return;
      var key = findCountryKeyByName(detectedCountry, countriesData);
      if (!key) return;
      fromSelect.value = key;
      var detectedEl = document.getElementById('detected-country');
      if (detectedEl) detectedEl.textContent = 'Detected location: ' + detectedCountry;
      updateResultFn();
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

  function deviceVoltageAdvice(v1, v2, device) {
    var profile = deviceProfiles[device] || deviceProfiles.phone;
    var a = Number(v1, 10);
    var b = Number(v2, 10);
    if (a === b) return 'Voltage is the same. Your devices should work normally.';
    var max = Math.max(a, b);
    if (max === 0) return '';
    var diff = Math.abs(a - b) / max;
    if (diff <= 0.20) {
      return 'Voltage difference is small. Most electronics will work safely.';
    }
    if (profile.dualVoltage === true) {
      return 'Most modern electronics like this device support dual voltage (100–240V), so it should work safely.';
    }
    if (profile.dualVoltage === false) {
      return 'This device usually does not support dual voltage. A voltage converter may be required.';
    }
    return 'Check your device label to confirm if it supports dual voltage (100–240V).';
  }

  function deviceAdviceSummary(device, v1, v2) {
    var profile = deviceProfiles[device] || deviceProfiles.phone;
    var label = deviceLabels[device] || device;
    var a = Number(v1, 10);
    var b = Number(v2, 10);
    var max = Math.max(a, b);
    var diff = max ? Math.abs(a - b) / max : 0;
    var largeDiff = diff > 0.20;
    if (profile.dualVoltage === true) {
      return 'Device selected: ' + label + '. Phones and similar electronics almost always support 100–240V, so it should work safely.';
    }
    if (profile.dualVoltage === false) {
      if (largeDiff) {
        return 'Device selected: ' + label + '. ' + label + 's are usually single-voltage devices. Because the voltage difference is large, a voltage converter may be required.';
      }
      return 'Device selected: ' + label + '. ' + label + 's usually do not support dual voltage. Check your device label.';
    }
    if (profile.dualVoltage === 'depends') {
      return 'Device selected: ' + label + '. Check your machine\'s label; some CPAP units support dual voltage (100–240V), others require a converter.';
    }
    if (profile.dualVoltage === 'sometimes') {
      return 'Device selected: ' + label + '. Many electric shavers support dual voltage; check your device label to confirm.';
    }
    return 'Device selected: ' + label + '.';
  }

  function parseVoltageRange(text) {
    if (!text || typeof text !== 'string') return null;
    var numbers = text.match(/\d+/g);
    if (!numbers || numbers.length === 0) return null;
    if (numbers.length === 1) {
      return { min: parseInt(numbers[0], 10), max: parseInt(numbers[0], 10) };
    }
    var min = parseInt(numbers[0], 10);
    var max = parseInt(numbers[1], 10);
    if (min > max) { var t = min; min = max; max = t; }
    return { min: min, max: max };
  }

  function checkDeviceVoltage(range, destinationVoltage) {
    if (!range) return null;
    var dest = Number(destinationVoltage, 10);
    if (dest >= range.min && dest <= range.max) return true;
    return false;
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
    var voltageMsg = deviceVoltageAdvice(from.voltage, to.voltage, selectedDevice);

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

    if (resultDeviceAdviceText) {
      resultDeviceAdviceText.textContent = deviceAdviceSummary(selectedDevice, from.voltage, to.voltage);
    }

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
      var deviceBtns = document.querySelectorAll('.device-selector button');
      for (var i = 0; i < deviceBtns.length; i++) {
        deviceBtns[i].addEventListener('click', function () {
          selectedDevice = this.getAttribute('data-device');
          for (var j = 0; j < deviceBtns.length; j++) deviceBtns[j].classList.remove('active');
          this.classList.add('active');
          updateResult();
        });
      }
      updateResult();
      autoSelectOriginCountry(countries, updateResult);

      var deviceVoltageInput = document.getElementById('device-voltage-input');
      var checkDeviceVoltageBtn = document.getElementById('check-device-voltage');
      var deviceVoltageResult = document.getElementById('device-voltage-result');
      if (checkDeviceVoltageBtn && deviceVoltageResult) {
        checkDeviceVoltageBtn.addEventListener('click', function () {
          var input = deviceVoltageInput ? deviceVoltageInput.value.trim() : '';
          var range = parseVoltageRange(input);
          var toKey = toSelect.value;
          var dest = toKey && countries[toKey] ? countries[toKey] : null;
          var destVoltage = dest && dest.voltage != null ? dest.voltage : null;
          var destName = dest ? dest.name : 'your destination';
          if (!range) {
            deviceVoltageResult.textContent = 'Unable to read the voltage range. Try entering something like 100-240 or 230.';
            deviceVoltageResult.className = 'device-voltage-result device-voltage-result--neutral';
            return;
          }
          if (destVoltage == null) {
            deviceVoltageResult.textContent = 'Select a destination country above first.';
            deviceVoltageResult.className = 'device-voltage-result device-voltage-result--neutral';
            return;
          }
          var ok = checkDeviceVoltage(range, destVoltage);
          deviceVoltageResult.className = 'device-voltage-result device-voltage-result--' + (ok ? 'yes' : 'no');
          if (ok) {
            deviceVoltageResult.textContent = 'Your device supports this voltage and should work safely in ' + destName + '.';
          } else {
            deviceVoltageResult.textContent = 'Your device may not support this voltage in ' + destName + '. A voltage converter may be required.';
          }
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
