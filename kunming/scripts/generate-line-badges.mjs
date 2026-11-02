import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const research = JSON.parse(readFileSync(new URL('./line-sign-research.json', import.meta.url), 'utf8'));
const ids = Object.keys(JSON.parse(readFileSync(new URL('../data/line-colors.json', import.meta.url), 'utf8')));
assert.deepEqual(new Set(research.lines.map(line => line.id)), new Set(ids));
const directory = new URL('../public/lines/', import.meta.url);
mkdirSync(directory, { recursive: true });
for (const line of research.lines) {
  const bytes = readFileSync(new URL(line.sourceFile, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), line.sourceSHA256, `${line.id}: source artwork changed`);
  const attributes = `width="${line.width}" height="${line.height}" role="img" aria-label="${line.label}" preserveAspectRatio="xMidYMid meet"`;
  const svg = line.sourceFormat === 'svg'
    ? bytes.toString('utf8').replace(/<svg\b([^>]*)>/, (_, original) => `<svg${original.replace(/\s(?:width|height|role|aria-label|preserveAspectRatio)="[^"]*"/g, '')} ${attributes}>`)
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${line.viewBox}" ${attributes}><image width="${line.width}" height="${line.height}" href="data:image/png;base64,${bytes.toString('base64')}"/></svg>`;
  writeFileSync(new URL(`${line.id}.svg`, directory), `${svg.trim()}\n`);
}
console.log(`Generated ${research.lines.length} source-verified ${research.city} line signs.`);
