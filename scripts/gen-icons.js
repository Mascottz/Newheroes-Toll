/*
 * Generates PWA icons from the NEWHEROES badge SVG (inlined here so no text
 * rendering is required — system fonts are not guaranteed in CI environments).
 *
 *   npm run icons
 *
 * Outputs: icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const RED = '#C8102E';

const starPath = (x, y, s) =>
  `<path transform="translate(${x} ${y}) scale(${s}) translate(-12 -12)" d="M12 2l2.95 6.05 6.65.93-4.85 4.6 1.18 6.6L12 16.9l-5.93 3.28 1.18-6.6L2.4 8.98l6.65-.93L12 2z"/>`;

const badgeSvg = (size) => {
  const c = size / 2;
  const tile = size / 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <pattern id="d" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse">
      <rect width="${tile}" height="${tile}" fill="#FDF2F8"/>
      <path d="M${tile / 2} 0 L${tile} ${tile / 2} L${tile / 2} ${tile} L0 ${tile / 2} Z" fill="#FDE8F2" stroke="#F472B6" stroke-width="${Math.max(1, size * 0.008)}"/>
    </pattern>
  </defs>
  <circle cx="${c}" cy="${c}" r="${size * 0.475}" fill="#FFFFFF" stroke="${RED}" stroke-width="${size * 0.042}"/>
  <circle cx="${c}" cy="${c}" r="${size * 0.4}" fill="url(#d)" stroke="${RED}" stroke-width="${size * 0.017}"/>
  <circle cx="${c}" cy="${c}" r="${size * 0.275}" fill="#FFFFFF" stroke="${RED}" stroke-width="${size * 0.017}"/>
  <g fill="${RED}">
    ${starPath(c, c - size * 0.017, size * 0.046)}
    ${starPath(c - size * 0.225, c - size * 0.15, size * 0.024)}
    ${starPath(c + size * 0.225, c - size * 0.15, size * 0.024)}
    ${starPath(c - size * 0.175, c + size * 0.16, size * 0.024)}
    ${starPath(c + size * 0.175, c + size * 0.16, size * 0.024)}
  </g>
</svg>`;
};

// Maskable icons need the badge inside the safe zone (central ~72%), with a
// full-bleed background so launchers can crop to any shape.
const maskableSvg = (size) => {
  const inner = size * 0.72;
  const off = (size - inner) / 2;
  const innerSvg = badgeSvg(inner).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#FDF2F8"/>
  <g transform="translate(${off} ${off})">${innerSvg}</g>
</svg>`;
};

const outDir = new URL('../public/icons/', import.meta.url).pathname;
await mkdir(outDir, { recursive: true });

await sharp(Buffer.from(badgeSvg(512))).png().toFile(`${outDir}/icon-512.png`);
await sharp(Buffer.from(badgeSvg(512))).resize(192, 192).png().toFile(`${outDir}/icon-192.png`);
await sharp(Buffer.from(maskableSvg(512))).png().toFile(`${outDir}/maskable-512.png`);
await sharp(Buffer.from(maskableSvg(180))).png().toFile(`${outDir}/apple-touch-icon.png`);

console.log('✓ PWA icons generated in public/icons/');
