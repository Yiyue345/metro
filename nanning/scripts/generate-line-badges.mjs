import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const colors = JSON.parse(readFileSync(new URL('../data/line-colors.json', import.meta.url), 'utf8'));
const glyphs = JSON.parse(readFileSync(new URL('./line-sign-glyphs.json', import.meta.url), 'utf8'));
// User-selected wayfinding variant: vertical colored numeral tile + black bilingual text.
// This differs from the circular numeric markers in the official network map.
// Badge artwork is independent of the schematic route palette in line-colors.json.
const signs = {
  '1': '#50bf5c',
  '2': '#e83922',
  '3': '#a719a6',
  '4': '#ced81c',
  '5': '#3558a3',
};
const outline = (label, x, y, height, width) => {
  const glyph = glyphs[label];
  if (!glyph) throw new Error(`Missing Nanning sign lettering: ${label}`);
  const scaleY = height / glyph.height;
  const scaleX = width ? width / glyph.width : scaleY;
  return `<path transform="translate(${x} ${y}) scale(${scaleX.toFixed(6)} ${scaleY.toFixed(6)})" d="${glyph.path}"/>`;
};
const directory = new URL('../public/lines/', import.meta.url);
mkdirSync(directory, { recursive: true });
for (const id of Object.keys(colors)) {
  const background = signs[id];
  const glyph = glyphs[id];
  if (!background || !glyph) throw new Error(`Missing researched Nanning line sign: ${id}`);
  const numeralX = (75 - glyph.width * 61 / glyph.height) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="205" height="100" viewBox="0 0 205 100" role="img" aria-label="${id}号线"><rect width="75" height="100" rx="2.5" fill="${background}"/><g fill="${id === '4' ? '#231815' : '#fff'}">${outline(id, numeralX.toFixed(3), 19.5, 61)}</g><g fill="#000">${outline('号线', 88, 0, 55, 117)}${outline(`Line ${id}`, 88, 68, 29, 107)}</g></svg>\n`;
  writeFileSync(new URL(`${id}.svg`, directory), svg);
}
console.log(`Generated ${Object.keys(colors).length} researched Nanning line signs.`);
