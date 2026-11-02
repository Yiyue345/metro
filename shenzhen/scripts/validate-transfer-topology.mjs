import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stationShapeUnionPath } from '../src/data/circle-union.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
let stations = 0, circles = 0, capsules = 0;
for (const [city, dataPath] of [['shenzhen', '../src/data'], ['kunming', '../../kunming/data'], ['hangzhou', '../../hangzhou/data']]) {
  const symbols = read(`${dataPath}/station-symbols.json`);
  const overrides = read(city === 'shenzhen' ? './transfer-topology-overrides.json' : `../../${city}/scripts/transfer-topology-overrides.json`);
  const colors = read(`${dataPath}/line-colors.json`);
  for (const [name, symbol] of Object.entries(symbols)) {
    if (!symbol.joined) continue;
    assert.deepEqual(symbol, overrides[name], `${city}/${name}: rebuild overrides must preserve topology`);
    assert(symbol.parts.length >= 2);
    const parts = symbol.parts.map(part => {
      assert(part.transfer && part.width >= part.height && part.height > 0);
      assert([part.x, part.y, part.width, part.height, part.angle].every(Number.isFinite));
      if (part.width === part.height) circles++; else capsules++;
      return { x: part.x, y: part.y, width: part.width + 1.6, height: part.height + 1.6, angle: part.angle, radius: part.width / 2 + .8 };
    });
    const reached = new Set([0]);
    for (let pass = 0; pass < parts.length; pass++) parts.forEach((part, i) => {
      if (parts.some((other, j) => reached.has(j) && Math.hypot(part.x - other.x, part.y - other.y) < part.radius + other.radius)) reached.add(i);
    });
    assert.equal(reached.size, parts.length, `${name}: circles must form one connected symbol`);
    const { x1, y1, x2, y2, lines } = symbol.gradient;
    assert([x1, y1, x2, y2].every(Number.isFinite) && Math.hypot(x2 - x1, y2 - y1) > 0);
    assert(lines.length >= 2 && lines.every(line => /^#[0-9a-f]{6}$/i.test(colors[line])));
    assert.deepEqual(new Set(lines), new Set(symbol.parts.flatMap(part => part.lines)));
    if (city === 'shenzhen' && name === '深圳北') {
      assert(symbol.parts[0].width > symbol.parts[0].height, '4/6 must share a capsule');
      assert.deepEqual(symbol.parts[0].lines, ['4', '6']);
      assert.equal(symbol.parts[1].width, symbol.parts[1].height, '5 must use a circle');
      assert.deepEqual(symbol.parts[1].lines, ['5']);
    }
    const path = stationShapeUnionPath(parts);
    assert(!/NaN|Infinity/.test(path));
    assert.equal((path.match(/M /g) ?? []).length, 1, `${name}: exposed arcs must form a single boundary`);
    assert.equal((path.match(/Z/g) ?? []).length, 1);
    stations++;
  }
}
console.log(`Validated ${stations} joined interchange symbols / ${circles} circles + ${capsules} capsules, continuous gradients, connected boundaries and rebuild overrides.`);
