/**
 * Cloudflare Pages Function — server-rendered /compatibility/{origin}-to-{dest}
 * @see https://developers.cloudflare.com/pages/functions/routing/
 */

import countries from '../../data/countries.json';

const SITE_ORIGIN = 'https://plugtype.world';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findSharedPlugs(a, b) {
  if (!a || !b) return [];
  return a.filter(function (type) {
    return b.indexOf(type) !== -1;
  });
}

function hasSharedPlugType(typesA, typesB) {
  return findSharedPlugs(typesA || [], typesB || []).length > 0;
}

function deviceVoltageAdvice(v1, v2) {
  var a = Number(v1);
  var b = Number(v2);
  if (a === b) return 'Voltage is the same. Your devices should work normally.';
  var max = Math.max(a, b);
  if (max === 0) return '';
  var diff = Math.abs(a - b) / max;
  if (diff <= 0.2) {
    return 'Voltage difference is small. Most electronics will work safely.';
  }
  return 'Most modern phones and chargers support dual voltage (100–240V), so they should work safely. High-power appliances may need a voltage converter—check each device label.';
}

function deviceAdvicePhone(v1, v2) {
  var a = Number(v1);
  var b = Number(v2);
  var max = Math.max(a, b);
  var diff = max ? Math.abs(a - b) / max : 0;
  var largeDiff = diff > 0.2;
  if (largeDiff) {
    return 'Phones almost always support 100–240V. Because the voltage difference is large, check high-power items (hair dryers, etc.) for a voltage converter.';
  }
  return 'Phones almost always support 100–240V, so yours should work safely. Check your charger label to confirm.';
}

function parsePairKeys(slug) {
  if (!slug || typeof slug !== 'string') return null;
  var i = slug.indexOf('-to-');
  if (i === -1) return null;
  var from = slug.slice(0, i).toLowerCase();
  var to = slug.slice(i + 4).toLowerCase();
  if (!from || !to || from === to) return null;
  if (!/^[a-z0-9-]+$/.test(from) || !/^[a-z0-9-]+$/.test(to)) return null;
  return { from, to };
}

function plugIconsHtml(plugTypes) {
  if (!plugTypes || plugTypes.length === 0) return '<p class="result-plug-label">—</p>';
  return plugTypes
    .map(function (type) {
      var letter = String(type).toLowerCase();
      return (
        '<div class="plug-icon"><img src="/images/type-' +
        escapeHtml(letter) +
        '.svg" alt="Plug type ' +
        escapeHtml(type) +
        '"><span>Type ' +
        escapeHtml(type) +
        '</span></div>'
      );
    })
    .join('');
}


export async function onRequest(context) {
  var slug = context.params.slug;

  var keys = parsePairKeys(String(slug));
  if (!keys) {
    var singleSlug = String(slug).toLowerCase().replace(/\/$/, '');
    if (/^[a-z0-9-]+$/.test(singleSlug) && countries[singleSlug]) {
      return new Response(null, {
        status: 301,
        headers: {
          'Location': '/countries/' + singleSlug,
          'Cache-Control': 'public, max-age=86400'
        }
      });
    }
    return new Response('Invalid route', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  var fromData = countries[keys.from];
  var toData = countries[keys.to];
  if (!fromData || !toData) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  var plugCompat = hasSharedPlugType(fromData.plug_types, toData.plug_types);
  var shared = findSharedPlugs(fromData.plug_types || [], toData.plug_types || []);
  var voltageMsg = deviceVoltageAdvice(fromData.voltage, toData.voltage);
  var deviceAdvice = deviceAdvicePhone(fromData.voltage, toData.voltage);

  var sharedText =
    shared.length > 0
      ? 'Shared plug type' + (shared.length > 1 ? 's: ' : ': ') + shared.join(', ')
      : 'No shared plug types. A travel adapter is required.';

  var compatText = 'Compatibility: ' + (plugCompat ? 'Compatible' : 'Adapter Required');
  var compatClass = plugCompat ? 'compatible' : 'adapter-required';
  var sharedClass = shared.length > 0 ? 'result-shared result-shared-yes' : 'result-shared result-shared-no';

  var vFrom = fromData.voltage != null ? fromData.voltage + 'V' : '—';
  var vTo = toData.voltage != null ? toData.voltage + 'V' : '—';
  var voltageLine = 'Voltage — ' + fromData.name + ' ' + vFrom + ' — ' + toData.name + ' ' + vTo;

  var va = parseFloat(fromData.voltage);
  var vb = parseFloat(toData.voltage);
  var deviceHint = '';
  if (Number.isFinite(va) && Number.isFinite(vb)) {
    var vmax = Math.max(va, vb);
    var voltageRatio = vmax ? Math.abs(va - vb) / vmax : 0;
    if (voltageRatio <= 0.2) {
      deviceHint =
        '<p id="device-hint" class="device-hint" role="status">You likely only need a plug adapter (if socket shapes differ). Voltage is close between these countries.</p>';
    } else {
      deviceHint =
        '<p id="device-hint" class="device-hint" role="status">You may need a voltage converter for some devices, especially high-power ones that are not dual-voltage. Check each device label.</p>';
    }
  }

  var title =
    fromData.name + ' to ' + toData.name + ' Plug Adapter & Voltage Guide | Plug Type World';
  var desc =
    'Check plug compatibility from ' +
    fromData.name +
    ' to ' +
    toData.name +
    '. See plug types, voltage, and whether you need a travel adapter or voltage converter.';
  var canonical = SITE_ORIGIN + '/compatibility/' + keys.from + '-to-' + keys.to;

  // --- Structured data ---

  var fromTypes = (fromData.plug_types || []).join(', ');
  var toTypes = (toData.plug_types || []).join(', ');
  var toTypesCount = (toData.plug_types || []).length;

  var adapterAnswer = plugCompat
    ? 'Both countries share plug type' + (shared.length > 1 ? 's ' : ' ') + shared.join(', ') +
      ', so your plug may fit without an adapter. Check your specific plug shape to confirm.'
    : 'Yes. ' + fromData.name + ' uses plug type' + ((fromData.plug_types || []).length !== 1 ? 's ' : ' ') +
      fromTypes + ' while ' + toData.name + ' uses ' + toTypes + '. You will need a travel adapter.';

  // Reuse voltageRatio already computed above; fall back to 0 if voltages were non-finite.
  var faqVoltageRatio = (Number.isFinite(va) && Number.isFinite(vb) && Math.max(va, vb) > 0)
    ? Math.abs(va - vb) / Math.max(va, vb)
    : 0;
  var voltageConverterAnswer = faqVoltageRatio <= 0.2
    ? 'No. Voltage difference is ' + vFrom + ' vs ' + vTo +
      ' — within tolerance for most modern dual-voltage electronics (100–240V).'
    : 'Potentially. ' + fromData.name + ' is ' + vFrom + ' and ' + toData.name + ' is ' + vTo +
      ' — a large difference. Dual-voltage chargers work fine. High-power appliances without ' +
      '100–240V support may need a voltage converter.';

  var plugTypesAnswer = toData.name + ' uses plug type' + (toTypesCount !== 1 ? 's: ' : ': ') +
    toTypes + '. Voltage: ' + (toData.voltage != null ? toData.voltage : '—') +
    'V, ' + (toData.frequency != null ? toData.frequency : '—') + 'Hz.';

  var ldJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE_ORIGIN + '/' },
          { '@type': 'ListItem', 'position': 2, 'name': 'Compatibility Guides', 'item': SITE_ORIGIN + '/compatibility/' },
          { '@type': 'ListItem', 'position': 3, 'name': fromData.name, 'item': SITE_ORIGIN + '/countries/' + keys.from },
          { '@type': 'ListItem', 'position': 4, 'name': fromData.name + ' to ' + toData.name, 'item': canonical }
        ]
      },
      {
        '@type': 'FAQPage',
        'mainEntity': [
          {
            '@type': 'Question',
            'name': 'Do I need a plug adapter from ' + fromData.name + ' to ' + toData.name + '?',
            'acceptedAnswer': { '@type': 'Answer', 'text': adapterAnswer }
          },
          {
            '@type': 'Question',
            'name': 'Do I need a voltage converter from ' + fromData.name + ' to ' + toData.name + '?',
            'acceptedAnswer': { '@type': 'Answer', 'text': voltageConverterAnswer }
          },
          {
            '@type': 'Question',
            'name': 'What plug types does ' + toData.name + ' use?',
            'acceptedAnswer': { '@type': 'Answer', 'text': plugTypesAnswer }
          }
        ]
      }
    ]
  }).replace(/</g, '\\u003c');

  var jsonLdBlock = '  <script type="application/ld+json">' + ldJson + '</script>\n';

  var html =
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>' +
    escapeHtml(title) +
    '</title>\n' +
    '  <meta name="description" content="' +
    escapeHtml(desc) +
    '">\n' +
    '  <link rel="canonical" href="' +
    escapeHtml(canonical) +
    '">\n' +
    '  <link rel="stylesheet" href="/css/styles.css">\n' +
    jsonLdBlock +
    '</head>\n' +
    '<body>\n' +
    '  <header class="hero">\n' +
    '    <p class="tagline"><a href="/">Plug Type World</a></p>\n' +
    '    <h1>' +
    escapeHtml(fromData.name) +
    ' → ' +
    escapeHtml(toData.name) +
    '</h1>\n' +
    '    <p class="tagline">Plug adapter &amp; voltage compatibility</p>\n' +
    '  </header>\n' +
    '  <main>\n' +
    '    <nav class="tool-context-links" aria-label="Breadcrumb"><a href="/">Home</a> · <a href="/">Compatibility tool</a></nav>\n' +
    '    <section class="result-section" id="result" aria-labelledby="result-title">\n' +
    '      <div class="result-card" id="result-card">\n' +
    '        <h2 class="result-title" id="result-title">' +
    escapeHtml(fromData.name + ' → ' + toData.name) +
    '</h2>\n' +
    '        <div class="result-plug-types">\n' +
    '          <p class="result-plug-label">' +
    escapeHtml(fromData.name) +
    ' plugs</p>\n' +
    '          <div class="plug-row">' +
    plugIconsHtml(fromData.plug_types) +
    '</div>\n' +
    '          <p class="result-plug-label">' +
    escapeHtml(toData.name) +
    ' plugs</p>\n' +
    '          <div class="plug-row">' +
    plugIconsHtml(toData.plug_types) +
    '</div>\n' +
    '        </div>\n' +
    '        <div class="' +
    escapeHtml(sharedClass) +
    '">' +
    escapeHtml(sharedText) +
    '</div>\n' +
    '        <div class="result-compat ' +
    escapeHtml(compatClass) +
    '">' +
    escapeHtml(compatText) +
    '</div>\n' +
    '        <div class="result-voltage">\n' +
    '          <p class="result-voltage-line">' +
    escapeHtml(voltageLine) +
    '</p>\n' +
    '          <p class="result-voltage-explanation">' +
    escapeHtml(voltageMsg) +
    '</p>\n' +
    '        </div>\n' +
    '        <div class="result-device-advice" id="result-device-advice">\n' +
    '          <h3 class="result-device-advice-title">Device compatibility (phones)</h3>\n' +
    '          <p class="result-device-advice-text">' +
    escapeHtml(deviceAdvice) +
    '</p>\n' +
    '        </div>\n' +
    deviceHint +
    '\n' +
    '        <p class="tool-context-links"><a href="/">Try the compatibility tool</a> · <a href="/adapter-vs-converter/">Adapter vs converter</a></p>\n' +
    '      </div>\n' +
    '    </section>\n' +
    '  </main>\n' +
    '  <footer>\n' +
    '    <p><a href="/about.html">About</a> · <a href="/contact.html">Contact</a></p>\n' +
    '  </footer>\n' +
    '</body>\n' +
    '</html>\n';

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600, must-revalidate'
    }
  });
}
