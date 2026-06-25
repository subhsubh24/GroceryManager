#!/usr/bin/env node
// Generate app icon PNGs, Android adaptive icon, and Google Play feature graphic from SVG source.
// Run once (in the CI/cloud runner environment) to produce committed image artifacts.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/generate-store-assets.mjs
//
// NOTE: The playwright import path and executablePath below are specific to the CI runner
// at /opt/node22 and /opt/pw-browsers. These files are committed as permanent artifacts —
// the script does not need to be re-run by the owner. If re-generation is needed locally,
// install playwright and update these paths accordingly.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SVG_PATH = join(root, 'apps/web/public/icons/icon.svg');
const ICONS_DIR = join(root, 'apps/web/public/icons');
const MOBILE_ASSETS_DIR = join(root, 'apps/mobile/assets');
const STORE_ASSETS_DIR = join(root, 'docs/store/assets');

const svgContent = readFileSync(SVG_PATH, 'utf8');
const svgBase64 = Buffer.from(svgContent).toString('base64');

for (const dir of [ICONS_DIR, MOBILE_ASSETS_DIR, STORE_ASSETS_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

const page = await browser.newPage();

// opaque=true fills transparent SVG corners with brand-green → no alpha channel (required for App Store/EAS)
async function screenshotSvgAt(size, outputPath, { opaque = true } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const bg = opaque ? '#0c8a3e' : 'transparent';
  const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}body{background:${bg}}</style></head><body><img src="data:image/svg+xml;base64,${svgBase64}" width="${size}" height="${size}" style="display:block"></body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: size, height: size }, omitBackground: !opaque });
  console.log(`✓ ${outputPath}`);
}

// App icon exports — opaque (no alpha): App Store + EAS require no alpha on the 1024px marketing icon
await screenshotSvgAt(1024, join(ICONS_DIR, 'icon-1024.png'), { opaque: true });
await screenshotSvgAt(512, join(ICONS_DIR, 'icon-512.png'), { opaque: true });
await screenshotSvgAt(192, join(ICONS_DIR, 'icon-192.png'), { opaque: true });

// Mobile (EAS) — no alpha (same requirement as App Store icon)
await screenshotSvgAt(1024, join(MOBILE_ASSETS_DIR, 'icon.png'), { opaque: true });

// Android adaptive icon foreground — transparent background (system applies shape/background color)
const leafOnlyBase64 = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g transform="translate(106 106) scale(12.5)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
  </g>
</svg>`).toString('base64');
await page.setViewportSize({ width: 1024, height: 1024 });
const adaptiveHtml = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}body{background:transparent}</style></head><body><img src="data:image/svg+xml;base64,${leafOnlyBase64}" width="1024" height="1024" style="display:block"></body></html>`;
await page.setContent(adaptiveHtml, { waitUntil: 'networkidle' });
await page.screenshot({ path: join(MOBILE_ASSETS_DIR, 'adaptive-icon.png'), clip: { x: 0, y: 0, width: 1024, height: 1024 }, omitBackground: true });
console.log(`✓ ${join(MOBILE_ASSETS_DIR, 'adaptive-icon.png')}`);

// Google Play feature graphic: 1024×500, brand green, centered leaf icon
const leafSvgBase64 = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
</svg>`).toString('base64');

await page.setViewportSize({ width: 1024, height: 500 });
const featureHtml = `<!DOCTYPE html><html><head><style>
  * { margin:0; padding:0; }
  body { width:1024px; height:500px; background:#0c8a3e; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:24px; font-family:'Helvetica Neue',Arial,sans-serif; }
  .icon-wrap { width:160px; height:160px; }
  .icon-wrap img { width:100%; height:100%; }
  .wordmark { color:#ffffff; font-size:48px; font-weight:700; letter-spacing:-0.5px; }
  .tagline { color:rgba(255,255,255,0.82); font-size:20px; font-weight:400; }
</style></head><body>
  <div class="icon-wrap"><img src="data:image/svg+xml;base64,${leafSvgBase64}"></div>
  <div class="wordmark">GroceryManager</div>
  <div class="tagline">Your grocery &amp; cooking autopilot</div>
</body></html>`;
await page.setContent(featureHtml, { waitUntil: 'networkidle' });
await page.screenshot({ path: join(STORE_ASSETS_DIR, 'feature-graphic.png'), clip: { x: 0, y: 0, width: 1024, height: 500 } });
console.log(`✓ ${join(STORE_ASSETS_DIR, 'feature-graphic.png')}`);

await browser.close();
console.log('\nAll store assets generated. Replace icon-1024.png + screenshots with real device captures before App Store submission.');
