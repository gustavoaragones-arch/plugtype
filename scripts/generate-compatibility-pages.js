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

function buildPage(originKey, destKey, countries, allDestKeys) {
  const origin = countries[originKey];
  const dest = countries[destKey];
  if (!origin || !dest) return null;

  const plugCompat = hasSharedPlugType(origin.plug_types, dest.plug_types);
  const voltagePct = voltageDiffPercent(origin.voltage, dest.voltage);
  const needVoltageWarning = voltagePct > 20;

  const originPlugLine = (origin.plug_types || []).join(' ') || '—';
  const destPlugLine = (dest.plug_types || []).join(' ') || '—';

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

  const breadcrumb = '<a href="/">Home</a> \u2192 <a href="/compatibility/">Compatibility Guides</a> \u2192 <a href="/compatibility/' + originKey + '/">' + origin.name + '</a> \u2192 ' + dest.name;
  const canonical = BASE + '/pages/compatibility/' + originKey + '-to-' + destKey + '.html';
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const replacements = {
    '{{TITLE}}': title,
    '{{META_DESCRIPTION}}': metaDesc,
    '{{CANONICAL}}': canonical,
    '{{H1}}': h1,
    '{{ARTICLE_JSON}}': articleJson,
    '{{BREADCRUMB}}': breadcrumb,
    '{{SUMMARY_TEXT}}': summaryText,
    '{{ORIGIN_NAME}}': origin.name,
    '{{DEST_NAME}}': dest.name,
    '{{ORIGIN_PLUG_LINE}}': originPlugLine,
    '{{DEST_PLUG_LINE}}': destPlugLine,
    '{{ADAPTER_EXPLANATION}}': adapterExplanation,
    '{{ORIGIN_VOLTAGE}}': origin.voltage ?? '—',
    '{{DEST_VOLTAGE}}': dest.voltage ?? '—',
    '{{ORIGIN_FREQ}}': origin.frequency ?? '—',
    '{{DEST_FREQ}}': dest.frequency ?? '—',
    '{{VOLTAGE_WARNING}}': voltageWarningHtml,
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
