// Renders every icon and splash image from one design using Playwright's Chromium:
//   web  — icons/icon-192.png, icons/icon-512.png (rounded, from icons/icon.svg)
//   iOS  — full-bleed 1024 app icon (no transparency, as Apple requires) and splash screens
//   Android — legacy, round and adaptive-foreground launcher icons, and splash screens
// Usage: npm run icons   (requires the `playwright` package; see README)
import { chromium } from 'playwright';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const BG = '#1d2419';
const GOLD = '#c8b273';
const SHIELD = `<path d="M256 84 118 132v104c0 87 58 150 138 176 80-26 138-89 138-176V132L256 84z" fill="${GOLD}" opacity=".18"/>
  <path d="M256 84 118 132v104c0 87 58 150 138 176 80-26 138-89 138-176V132L256 84z" fill="none" stroke="${GOLD}" stroke-width="22" stroke-linejoin="round"/>
  <path d="m186 262 48 48 96-106" fill="none" stroke="${GOLD}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>`;

// Shield artwork centred in a square, scaled so it fills `scale` of the square.
const mark = (scale) => {
  const pad = (512 / scale - 512) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${512 + 2 * pad} ${512 + 2 * pad}" width="100%" height="100%">${SHIELD}</svg>`;
};

const pngSize = async (path) => {
  const buf = await readFile(path);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(path, w, h, html, { transparent = false } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${transparent ? 'transparent' : BG}}
      .c{width:100%;height:100%;display:flex;align-items:center;justify-content:center}</style><div class="c">${html}</div>`,
  );
  await page.screenshot({ path, omitBackground: transparent });
}

// Web / PWA icons (rounded corners are part of the SVG).
const webSvg = await readFile(`${root}icons/icon.svg`, 'utf8');
for (const size of [192, 512]) {
  await render(`${root}icons/icon-${size}.png`, size, size, webSvg.replace('<svg ', '<svg width="100%" height="100%" '));
}

// iOS: one 1024 px full-bleed icon (iOS applies the rounded mask itself).
await render(`${root}ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`, 1024, 1024, mark(0.78));

// Splash screens: small mark on the app background, at whatever sizes the templates use.
const splashLogo = (w, h) => `<div style="width:${Math.round(Math.min(w, h) * 0.28)}px;height:${Math.round(Math.min(w, h) * 0.28)}px">${mark(0.95)}</div>`;
const iosSplash = `${root}ios/App/App/Assets.xcassets/Splash.imageset`;
for (const f of (await readdir(iosSplash)).filter((f) => f.endsWith('.png'))) {
  const { w, h } = await pngSize(`${iosSplash}/${f}`);
  await render(`${iosSplash}/${f}`, w, h, splashLogo(w, h));
}

// Android launcher icons.
const res = `${root}android/app/src/main/res`;
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENSITIES)) {
  const legacy = Math.round(48 * k);
  const fg = Math.round(108 * k);
  await render(`${res}/mipmap-${d}/ic_launcher.png`, legacy, legacy, `<div style="width:100%;height:100%;border-radius:18%;background:${BG}">${mark(0.8)}</div>`, { transparent: true });
  await render(`${res}/mipmap-${d}/ic_launcher_round.png`, legacy, legacy, `<div style="width:100%;height:100%;border-radius:50%;background:${BG}">${mark(0.72)}</div>`, { transparent: true });
  // Adaptive foreground: artwork must sit inside the central 66/108 safe zone.
  await render(`${res}/mipmap-${d}/ic_launcher_foreground.png`, fg, fg, mark(0.55), { transparent: true });
}
for (const dir of (await readdir(res)).filter((d) => d.startsWith('drawable'))) {
  const p = `${res}/${dir}/splash.png`;
  if (!(await stat(p).catch(() => null))) continue;
  const { w, h } = await pngSize(p);
  await render(p, w, h, splashLogo(w, h));
}

await browser.close();
console.log('Icons and splash screens written for web, iOS and Android');
