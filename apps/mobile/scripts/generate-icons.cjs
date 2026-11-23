// Regenerates the app icons and splash image from SVG.
// Usage (from apps/mobile): npm i --no-save @resvg/resvg-js@2 && node scripts/generate-icons.cjs assets
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

const out = process.argv[2];
if (!out) throw new Error('Pass the assets directory');

const NAVY = '#172b4d';
const NAVY_LIGHT = '#24427a';
const BLUE = '#3867d6';
const SKY = '#6f97ff';

/**
 * The glyph: a calendar card with a check mark, drawn in a 1024 box around (512, 512).
 * `scale` shrinks it about the centre; `mono` draws it in white only (Android themed icon).
 */
function glyph({ scale = 1, mono = false } = {}) {
  const card = mono ? '#fff' : '#fff';
  const header = mono ? '#fff' : BLUE;
  const check = mono ? 'transparent' : BLUE;
  const rings = mono ? '#fff' : NAVY;
  const transform = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  // In the monochrome version the check is cut out of the card so it still reads as one colour.
  const checkPath = 'M372 586 L470 682 L668 470';
  return `
    <g transform="${transform}">
      <defs>
        <mask id="cut">
          <rect width="1024" height="1024" fill="#fff"/>
          ${mono ? `<path d="${checkPath}" stroke="#000" stroke-width="64" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <rect x="232" y="410" width="560" height="26" fill="#000"/>` : ''}
        </mask>
      </defs>
      <g mask="url(#cut)">
        <rect x="232" y="262" width="560" height="520" rx="76" fill="${card}"/>
        <path d="M232 338 a76 76 0 0 1 76 -76 h408 a76 76 0 0 1 76 76 v84 h-560 z" fill="${header}"/>
      </g>
      ${mono ? '' : `<path d="${checkPath}" stroke="${check}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`}
      <rect x="352" y="214" width="44" height="112" rx="22" fill="${rings}" stroke="${mono ? 'none' : '#fff'}" stroke-width="${mono ? 0 : 14}"/>
      <rect x="628" y="214" width="44" height="112" rx="22" fill="${rings}" stroke="${mono ? 'none' : '#fff'}" stroke-width="${mono ? 0 : 14}"/>
    </g>`;
}

const background = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY_LIGHT}"/>
      <stop offset="1" stop-color="${NAVY}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.75" cy="0.2" r="0.6">
      <stop offset="0" stop-color="${SKY}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${SKY}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;

function render(name, body, size = 1024) {
  const png = new Resvg(svg(body), { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(out, name), png);
  console.log(`${name} (${size}px, ${png.length} bytes)`);
}

// iOS / default icon: full bleed, no transparency (the OS rounds the corners).
render('icon.png', background + glyph({ scale: 0.92 }));
// Android adaptive icon: background and foreground layers; keep the glyph inside the ~66% safe zone.
render('android-icon-background.png', background);
render('android-icon-foreground.png', glyph({ scale: 0.66 }));
render('android-icon-monochrome.png', glyph({ scale: 0.66, mono: true }));
// Splash: the glyph alone; the background colour comes from app.json (light and dark).
render('splash-icon.png', glyph({ scale: 1 }));
// Web favicon.
render('favicon.png', background + glyph({ scale: 0.95 }), 48);
