/**
 * Generate the QuickBiz home-screen icons.
 *
 * Dependency-free on purpose: Node's built-in zlib plus a tiny PNG encoder, so
 * regenerating the icons never installs anything. The geometry matches
 * `apps/web/src/components/brand/logo.tsx` and `public/favicon.svg`.
 *
 * Usage: node scripts/generate-brand-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const BOLT = [
  [28.5, 6],
  [14, 26.5],
  [21.6, 26.5],
  [19, 42],
  [34.5, 21],
  [26.3, 21],
];

const VIOLET = [124, 92, 255];
const BLUE = [46, 141, 255];
const WHITE = [255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function insideRoundedSquare(x, y, size, radius) {
  const min = 0;
  const max = size;
  if (x < min || x > max || y < min || y > max) return false;

  const nearestX = Math.min(Math.max(x, radius), size - radius);
  const nearestY = Math.min(Math.max(y, radius), size - radius);
  const dx = x - nearestX;
  const dy = y - nearestY;
  return (
    dx * dx + dy * dy <= radius * radius ||
    (x >= radius && x <= size - radius) ||
    (y >= radius && y <= size - radius)
  );
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Render one icon.
 *
 * `maskable` uses a full-bleed background with the bolt inside the central 80 %
 * safe zone, which is what Android expects for adaptive icons.
 */
function renderIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.24;
  const scale = (maskable ? 0.55 : 0.78) * (size / 48);
  const offsetX = (size - 48 * scale) / 2;
  const offsetY = (size - 48 * scale) / 2;
  const polygon = BOLT.map(([x, y]) => [x * scale + offsetX, y * scale + offsetY]);
  const samples = 3;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let tileHits = 0;
      let boltHits = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          const onTile = maskable || insideRoundedSquare(px, py, size, radius);
          if (!onTile) continue;
          tileHits += 1;
          if (insidePolygon(px, py, polygon)) boltHits += 1;
        }
      }

      const total = samples * samples;
      if (tileHits === 0) continue;

      const offset = (y * size + x) * 4;
      const boltCoverage = boltHits / total;
      const tileCoverage = tileHits / total;

      // Diagonal gradient matching the SVG.
      const t = (x / size + y / size) / 2;
      const base = mix(VIOLET, BLUE, t);
      const colour = mix(base, WHITE, boltCoverage);

      rgba[offset] = colour[0];
      rgba[offset + 1] = colour[1];
      rgba[offset + 2] = colour[2];
      rgba[offset + 3] = Math.round(255 * tileCoverage);
    }
  }

  return encodePng(size, size, rgba);
}

const outputDirectory = resolve('apps/web/public');
mkdirSync(outputDirectory, { recursive: true });

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
];

for (const [name, size, options] of targets) {
  const file = resolve(outputDirectory, name);
  writeFileSync(file, renderIcon(size, options));
  console.log(`wrote ${name} (${size}×${size})`);
}

void dirname;
