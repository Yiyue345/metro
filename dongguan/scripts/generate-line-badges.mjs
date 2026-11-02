import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const colors = JSON.parse(readFileSync(new URL('../data/line-colors.json', import.meta.url), 'utf8'));
const glyphs = JSON.parse(readFileSync(new URL('./line-sign-glyphs.json', import.meta.url), 'utf8'));
// Current operating-network signs; obsolete Commons R1/R2 placeholders are not references.
const signs = { '1': '#2e3192', '2': '#ed1c24' };
const outline = (label, x, y, height) => {
  const glyph = glyphs[label];
  if (!glyph) throw new Error(`Missing Dongguan sign lettering: ${label}`);
  return `<path transform="translate(${x} ${y}) scale(${(height / glyph.height).toFixed(6)})" d="${glyph.path}"/>`;
};
const directory = new URL('../public/lines/', import.meta.url);
mkdirSync(directory, { recursive: true });
for (const id of Object.keys(colors)) {
  const color = signs[id];
  if (!color) throw new Error(`Missing researched Dongguan line sign: ${id}`);
  const numeral = glyphs[id];
  const numeralX = 39 - (numeral.width * 82 / numeral.height) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="100" viewBox="0 0 220 100" role="img" aria-label="${id}号线"><rect width="220" height="100" rx="4" fill="${color}"/><g fill="#fff">${outline(id, numeralX.toFixed(3), 9, 82)}${outline('号线', 83, 10, 49)}${outline(`Line ${id}`, 83, 69, 22)}</g></svg>\n`;
  writeFileSync(new URL(`${id}.svg`, directory), svg);
}
console.log(`Generated ${Object.keys(colors).length} researched Dongguan line signs.`);
