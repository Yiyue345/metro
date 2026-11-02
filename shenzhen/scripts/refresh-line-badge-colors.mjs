import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Sample the artwork, since sign palettes can differ from schematic route colors.
const result = {};
for (const city of ['shenzhen', 'chengdu', 'dongguan', 'hangzhou', 'kunming', 'nanning', 'shaoxing']) {
  const base = new URL(`../../${city}/`, import.meta.url);
  const colorsPath = city === 'shenzhen' ? 'src/data/line-colors.json' : 'data/line-colors.json';
  const colors = JSON.parse(readFileSync(new URL(colorsPath, base), 'utf8'));
  result[city] = {};
  for (const id of Object.keys(colors)) {
    const source = readFileSync(new URL(`public/lines/${id}.svg`, base));
    const { data } = await sharp(source).resize({ width: 128 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const histogram = new Map();
    for (let p = 0; p < data.length; p += 4) {
      const [r, g, b, a] = data.subarray(p, p + 4);
      if (a < 240 || Math.min(r, g, b) > 240 || Math.max(r, g, b) < 45) continue;
      const color = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
      histogram.set(color, (histogram.get(color) ?? 0) + 1);
    }
    result[city][id] = { color: [...histogram].sort((a, b) => b[1] - a[1])[0]?.[0] ?? colors[id], sha256: createHash('sha256').update(source).digest('hex') };
  }
}
writeFileSync(new URL('../src/data/line-badge-colors.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log('Updated artwork colors for seven cities.');
