#!/usr/bin/env node
/**
 * Generate static compatibility pages (origin → destination).
 * All country pairs: every origin × every destination (excluding same country).
 * Run from project root: node scripts/generate-compatibility-pages.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');
const TEMPLATE_PATH = path.join(PROJECT_ROOT, 'templates', 'compatibility-template.html');
const OUT_DIR = path.join(PROJECT_ROOT, 'pages', 'compatibility');
const BASE = 'https://plugtype.world';
const BUILD_DATE = new Date().toISOString().split('T')[0];

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hasSharedPlugType(typesA, typesB) {
  if (!typesA || !typesB) return false;
  for (let i = 0; i < typesA.length; i++) {
    for (let j = 0; j < typesB.length; j++) {
      if (typesA[i] === typesB[j]) return true;
    }
  }
  return false;
}

function voltageDiffPercent(v1, v2) {
  const a = Number(v1);
  const b = Number(v2);
  if (!a || !b) return 0;
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  return ((max - min) / min) * 100;
}

/** Relative voltage difference vs max (0–1); matches tool.js 20% threshold when <= 0.20 */
function voltageRelativeRatio(v1, v2) {
  const a = Number(v1);
  const b = Number(v2);
  if (!a || !b) return 0;
  return Math.abs(a - b) / Math.max(a, b);
}

function generateShortExplanation(origin, dest) {
  const originName = escapeHtml(origin.name);
  const destName = escapeHtml(dest.name);
  const ov = origin.voltage != null ? escapeHtml(String(origin.voltage)) : '—';
  const dv = dest.voltage != null ? escapeHtml(String(dest.voltage)) : '—';
  return (
    '<section class="why-different">\n' +
    '  <h2>Why is this different?</h2>\n' +
    '  <p>\n' +
    '    ' + originName + ' uses ' + ov + 'V electricity, while ' + destName + ' uses ' + dv + 'V.\n' +
    '    These electrical systems developed independently, which is why both voltage and plug types differ.\n' +
    '  </p>\n' +
    '</section>\n'
  );
}

function generateAdapterConverterBlock(voltageRatio) {
  const low = voltageRatio <= 0.2;
  const recommendation = low
    ? 'In most cases, you will only need a plug adapter for this route.'
    : 'Because the voltage difference is significant, some devices may require a voltage converter.';
  return (
    '<section class="adapter-converter-info">\n' +
    '  <h2>Plug adapter vs voltage converter</h2>\n' +
    '  <p><strong>Plug adapter:</strong> Allows your plug to fit into a different socket. It does not change voltage.</p>\n' +
    '  <p><strong>Voltage converter:</strong> Changes the electrical voltage to match your device requirements.</p>\n' +
    '  <p>' + recommendation + '</p>\n' +
    '</section>\n'
  );
}

function generateAdapterWarningBox() {
  return (
    '<div class="warning-box">\n' +
    '  <p><strong>Important:</strong> Plug adapters do not convert voltage.</p>\n' +
    '  <p>Always check your device label (e.g. 100–240V).</p>\n' +
    '</div>\n'
  );
}

function pickRelated(originKey, destKey, allDestKeys, countries, n) {
  const out = [];
  const seen = new Set([originKey, destKey]);
  const pool = allDestKeys.filter(k => k !== destKey);
  for (let i = 0; i < pool.length && out.length < n; i++) {
    const k = pool[i];
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ key: k, name: countries[k].name });
  }
  return out.slice(0, n);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Stable per route (not Math.random) so content does not churn on every regeneration. */
function deterministicVariantIndex(originKey, destKey, modulo) {
  const s = originKey + '\x1e' + destKey;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % modulo;
}

function buildPairIntro(origin, dest, originKey, destKey) {
  const from = escapeHtml(origin.name);
  const to = escapeHtml(dest.name);
  const intros = [
    `Traveling from ${from} to ${to}? This guide explains plug types, voltage differences, and whether you need a travel adapter or converter.`,
    `If you're going from ${from} to ${to}, here's what you need to know about plugs and voltage.`,
    `Planning a trip from ${from} to ${to}? Check compatibility, voltage, and adapter requirements here.`
  ];
  const idx = deterministicVariantIndex(originKey, destKey, intros.length);
  return intros[idx];
}

function generateDevicesAndAdapterSections(origin, dest, plugCompat, originPlugLine, destPlugLine, originKey, destKey) {
  const from = escapeHtml(origin.name);
  const to = escapeHtml(dest.name);
  const plugsDest = escapeHtml(destPlugLine);

  const deviceOpenings = [
    'If your device supports <strong>100–240V</strong>, it will work in ' + to + ' with just a plug adapter when the socket shape differs.',
    'Devices rated <strong>100–240V</strong> are widely compatible in ' + to + '—you typically only need the right plug adapter for the outlet.',
    'Dual-voltage gear (often labeled <strong>100–240V</strong>) can run in ' + to + ' once you have a matching plug or adapter.'
  ];
  const dIdx = deterministicVariantIndex(originKey + ':devices', destKey, deviceOpenings.length);

  let adapterLead;
  if (plugCompat) {
    adapterLead =
      'You might not need a plug shape adapter if your device already uses a type common to both countries. ' +
      'If your plug does not match any outlet type in ' +
      to +
      ', you will still need a travel adapter.';
  } else {
    adapterLead =
      'Yes — if your plug type from ' +
      from +
      ' does not match the outlets in ' +
      to +
      ', you will need a travel adapter.';
  }

  const adapterSecondaries = [
    to + ' uses plug types ' + plugsDest + ', which may differ from ' + from + '.',
    'Outlets in ' + to + ' are built for plug types ' + plugsDest + '; compare those with what you use in ' + from + '.',
    'Expect plug types ' + plugsDest + ' in ' + to + '—they are not always the same as in ' + from + '.'
  ];
  const aIdx = deterministicVariantIndex(originKey + ':adapter2', destKey, adapterSecondaries.length);

  return (
    '<section class="compat-devices">\n' +
    '  <h2>Can you use your devices in ' +
    to +
    '?</h2>\n' +
    '  <p>' +
    deviceOpenings[dIdx] +
    ' Most modern electronics like phones and laptops are dual voltage.</p>\n' +
    '  <p>If your device is single voltage (for example 120V only), you may need a voltage converter.</p>\n' +
    '</section>\n' +
    '<section class="compat-adapter-need">\n' +
    '  <h2>Do you need a plug adapter for ' +
    to +
    '?</h2>\n' +
    '  <p>' +
    adapterLead +
    '</p>\n' +
    '  <p>' +
    adapterSecondaries[aIdx] +
    '</p>\n' +
    '</section>\n'
  );
}

function buildCountryDeepLinks(originKey, destKey, origin, dest) {
  const on = escapeHtml(origin.name);
  const dn = escapeHtml(dest.name);
  return (
    '<p class="country-links">' +
    'From ' +
    on +
    ': ' +
    '<a href="../countries/' +
    originKey +
    '.html">' +
    on +
    ' plug types &amp; voltage</a><br>\n' +
    'To ' +
    dn +
    ': ' +
    '<a href="../countries/' +
    destKey +
    '.html">' +
    dn +
    ' plug types &amp; voltage</a>' +
    '</p>\n'
  );
}

function buildClosingNote(origin, dest) {
  const from = escapeHtml(origin.name);
  const to = escapeHtml(dest.name);
  return (
    'Always check your device label before traveling from ' +
    from +
    ' to ' +
    to +
    '. This ensures safe and reliable use of your electronics abroad.'
  );
}

function buildPage(originKey, destKey, countries, allDestKeys) {
  const origin = countries[originKey];
  const dest = countries[destKey];
  if (!origin || !dest) return null;

  const plugCompat = hasSharedPlugType(origin.plug_types, dest.plug_types);
  const voltagePct = voltageDiffPercent(origin.voltage, dest.voltage);
  const needVoltageWarning = voltagePct > 20;

  const originPlugLine = (origin.plug_types || []).join(' ') || '—';
  const destPlugLine = (dest.plug_types || []).join(' ') || '—';
  const toPlugWord = (dest.plug_types || []).length > 1 ? 'types' : 'type';
  const fromVoltageNumeric =
    origin.voltage != null && origin.voltage !== '' ? escapeHtml(String(origin.voltage)) : '—';
  const toVoltageNumeric =
    dest.voltage != null && dest.voltage !== '' ? escapeHtml(String(dest.voltage)) : '—';
  const toFrequencyNumeric =
    dest.frequency != null && dest.frequency !== '' ? escapeHtml(String(dest.frequency)) : '—';

  let summaryText = plugCompat
    ? `Your ${origin.name} plug may fit in ${dest.name} outlets, as both use at least one common plug type.`
    : `You will need a travel adapter in ${dest.name}; plug types used there differ from ${origin.name}.`;

  if (needVoltageWarning) {
    summaryText += ` Voltage differs by more than 20% — a voltage converter may be needed for some appliances.`;
  }

  const adapterExplanation = plugCompat
    ? `Both countries share at least one plug type (${originPlugLine} and ${destPlugLine}), so some plugs may work without an adapter. Check your appliance.`
    : `There is no common plug type between ${origin.name} (${originPlugLine}) and ${dest.name} (${destPlugLine}). You need a travel adapter.`;

  let voltageWarningHtml = '';
  if (needVoltageWarning) {
    voltageWarningHtml = `<p class="result-warning">Voltage converter recommended (${origin.name} ${origin.voltage}V vs ${dest.name} ${dest.voltage}V).</p>`;
  } else {
    voltageWarningHtml = '<p>Voltage difference is within a range many devices tolerate; check your appliance label.</p>';
  }

  const title = `${origin.name} to ${dest.name} Plug Adapter & Voltage Guide`;
  const metaDesc = `Check plug compatibility from ${origin.name} to ${dest.name}. See if you need a travel adapter or voltage converter.`;
  const h1 = `${origin.name} → ${dest.name} Plug Adapter Guide`;

  const articleJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: metaDesc,
    about: [
      { '@type': 'Place', name: origin.name },
      { '@type': 'Place', name: dest.name }
    ]
  });

  const related = pickRelated(originKey, destKey, allDestKeys, countries, 5);
  const relatedLinks = related
    .map(r => `<a href="${originKey}-to-${r.key}.html">${origin.name} → ${escapeHtml(r.name)}</a>`)
    .join(' · ');

  const pairIntro = buildPairIntro(origin, dest, originKey, destKey);
  const devicesAndAdapterSections = generateDevicesAndAdapterSections(
    origin,
    dest,
    plugCompat,
    originPlugLine,
    destPlugLine,
    originKey,
    destKey
  );
  const closingNote = buildClosingNote(origin, dest);
  const countryDeepLinks = buildCountryDeepLinks(originKey, destKey, origin, dest);

  const voltageRatio = voltageRelativeRatio(origin.voltage, dest.voltage);
  const contextualAuthority =
    generateShortExplanation(origin, dest) +
    '<p class="authority-learn-more">Learn more: <a href="/why-plug-types-differ/">Why plug types differ worldwide</a></p>\n' +
    generateAdapterConverterBlock(voltageRatio) +
    generateAdapterWarningBox() +
    '<p class="authority-learn-more">Learn more: <a href="/adapter-vs-converter/">Adapter vs Converter explained</a></p>\n';

  const breadcrumb = '<a href="/">Home</a> \u2192 <a href="/compatibility/">Compatibility Guides</a> \u2192 <a href="/compatibility/' + originKey + '/">' + origin.name + '</a> \u2192 ' + dest.name;
  const canonical = BASE + '/pages/compatibility/' + originKey + '-to-' + destKey + '.html';
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const replacements = {
    '{{TITLE}}': title,
    '{{META_DESCRIPTION}}': metaDesc,
    '{{CANONICAL}}': canonical,
    '{{H1}}': h1,
    '{{PAIR_INTRO}}': pairIntro,
    '{{DEVICES_AND_ADAPTER_SECTIONS}}': devicesAndAdapterSections,
    '{{CLOSING_NOTE}}': closingNote,
    '{{ARTICLE_JSON}}': articleJson,
    '{{BREADCRUMB}}': breadcrumb,
    '{{SUMMARY_TEXT}}': summaryText,
    '{{ORIGIN_NAME}}': origin.name,
    '{{DEST_NAME}}': dest.name,
    '{{FROM_COUNTRY}}': origin.name,
    '{{TO_COUNTRY}}': dest.name,
    '{{FROM_VOLTAGE}}': fromVoltageNumeric,
    '{{TO_VOLTAGE}}': toVoltageNumeric,
    '{{FROM_PLUGS}}': originPlugLine,
    '{{TO_PLUGS}}': destPlugLine,
    '{{TO_PLUG_WORD}}': toPlugWord,
    '{{TO_FREQUENCY}}': toFrequencyNumeric,
    '{{ORIGIN_PLUG_LINE}}': originPlugLine,
    '{{DEST_PLUG_LINE}}': destPlugLine,
    '{{ADAPTER_EXPLANATION}}': adapterExplanation,
    '{{ORIGIN_VOLTAGE}}': origin.voltage ?? '—',
    '{{DEST_VOLTAGE}}': dest.voltage ?? '—',
    '{{ORIGIN_FREQ}}': origin.frequency ?? '—',
    '{{DEST_FREQ}}': dest.frequency ?? '—',
    '{{VOLTAGE_WARNING}}': voltageWarningHtml,
    '{{BUILD_DATE}}': BUILD_DATE,
    '{{COUNTRY_DEEP_LINKS}}': countryDeepLinks,
    '{{CONTEXTUAL_AUTHORITY}}': contextualAuthority,
    '{{HOME_LINK}}': '../../index.html',
    '{{CSS_PATH}}': '../../css/styles.css',
    '{{ROOT}}': '../../',
    '{{ORIGIN_COUNTRY_LINK}}': `../countries/${originKey}.html`,
    '{{DEST_COUNTRY_LINK}}': `../countries/${destKey}.html`,
    '{{RELATED_LINKS}}': relatedLinks || '—'
  };

  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }
  return html;
}

function main() {
  const countries = loadJSON(COUNTRIES_PATH);
  const allKeys = Object.keys(countries).sort((a, b) =>
    (countries[a].name || '').localeCompare(countries[b].name || '')
  );

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let count = 0;
  for (const originKey of allKeys) {
    if (!countries[originKey]) continue;
    for (const destKey of allKeys) {
      if (originKey === destKey) continue;
      if (!countries[destKey]) continue;
      const html = buildPage(originKey, destKey, countries, allKeys);
      if (!html) continue;
      const filename = `${originKey}-to-${destKey}.html`;
      const outPath = path.join(OUT_DIR, filename);
      fs.writeFileSync(outPath, html, 'utf8');
      count++;
      if (count % 5000 === 0) console.log('Generated', count, 'pages...');
    }
  }

  console.log('Done. Generated', count, 'compatibility pages.');
}

main();
