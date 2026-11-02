import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { lineBadgeSize } from '../src/data/line-badge-size.mjs';

let total = 0;
const artworkColors = JSON.parse(readFileSync(new URL('../src/data/line-badge-colors.json', import.meta.url), 'utf8'));
for (const city of ['dongguan', 'nanning', 'kunming', 'hangzhou', 'shaoxing', 'chengdu']) {
  const directory = new URL(`../../${city}/`, import.meta.url);
  const colors = JSON.parse(readFileSync(new URL('data/line-colors.json', directory), 'utf8'));
  for (const id of Object.keys(colors)) {
    const svg = readFileSync(new URL(`public/lines/${id}.svg`, directory), 'utf8');
    const size = lineBadgeSize(city, id);
    assert.equal(artworkColors[city][id].sha256, createHash('sha256').update(svg).digest('hex'), `${city}/${id}: run refresh-line-badge-colors.mjs after updating artwork`);
    assert(size.width / size.height > .2 && size.width / size.height < 10, `${city}/${id}: invalid aspect ratio`);
    assert(!/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i.test(svg), `${city}/${id}: executable or remote SVG content`);
    assert(!/lengthAdjust\s*=\s*["']spacingAndGlyphs/i.test(svg), `${city}/${id}: distorted glyphs`);
    total++;
  }
  console.log(`${city}: ${Object.keys(colors).length} local badges with native dimensions`);
}
assert.throws(() => lineBadgeSize('../chengdu', '1'));
assert.throws(() => lineBadgeSize('chengdu', '../1'));
console.log(`Validated ${total} line badges, intrinsic proportions and self-contained resources.`);
