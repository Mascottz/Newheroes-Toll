/*
 * Generates PWA icons from the real NEWHEROES logo (public/brand/logo-full.jpg
 * — the uploaded original, kept at full quality).
 *
 *   npm run icons
 *
 * Outputs: icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = new URL('../public/brand/logo-full.jpg', import.meta.url).pathname;
const outDir = new URL('../public/icons/', import.meta.url).pathname;
const BRAND_BG = '#FDF2F8'; // brand-50 pink, matches the app background

await mkdir(outDir, { recursive: true });

// Standard icons — the logo fills the tile edge-to-edge (cover-cropped square).
// .flatten() guarantees a fully opaque image (the JPEG source can carry an
// alpha channel after conversion).
await sharp(SRC)
  .resize(512, 512, { fit: 'cover', position: 'centre' })
  .flatten({ background: '#FFFFFF' })
  .png()
  .toFile(`${outDir}/icon-512.png`);
await sharp(SRC)
  .resize(192, 192, { fit: 'cover', position: 'centre' })
  .flatten({ background: '#FFFFFF' })
  .png()
  .toFile(`${outDir}/icon-192.png`);

// Maskable icon — the logo sits inside the safe zone (central ~78%) on a
// full-bleed brand background so launchers can crop to any shape.
const inner = await sharp(SRC).resize(400, 400, { fit: 'inside' }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: BRAND_BG } })
  .composite([{ input: inner, gravity: 'centre' }])
  .flatten({ background: BRAND_BG })
  .png()
  .toFile(`${outDir}/maskable-512.png`);

// Apple touch icon — opaque square, logo edge-to-edge.
await sharp(SRC)
  .resize(180, 180, { fit: 'cover', position: 'centre' })
  .flatten({ background: '#FFFFFF' })
  .png()
  .toFile(`${outDir}/apple-touch-icon.png`);

console.log('✓ PWA icons generated from the uploaded logo in public/icons/');
