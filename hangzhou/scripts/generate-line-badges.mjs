import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const research = JSON.parse(readFileSync(new URL('./line-sign-research.json', import.meta.url), 'utf8'));
const colors = JSON.parse(readFileSync(new URL('../data/line-colors.json', import.meta.url), 'utf8'));
const numerals = JSON.parse(readFileSync(new URL('./line-sign-numerals.json', import.meta.url), 'utf8'));
const directory = new URL('../public/lines/', import.meta.url);
mkdirSync(directory, { recursive: true });

// Match each source icon's plate, without stretching the numeral or lettering.
for (const id of Object.keys(colors)) {
  const sign = research.lines.find((line) => line.id === id);
  if (!sign) throw new Error(`Missing line-sign research for ${id}`);
  const wide = id.length > 1;
  const width = id === 'hh' ? 164 : wide ? 130.434783 : 100;
  const label = id === 'hh' ? '杭海城际' : `${id}号线`;
  const numeral = numerals[id];
  const content = id === 'hh'
    ? `<g fill="white" font-family="Arial, Microsoft YaHei, sans-serif" text-anchor="middle"><text x="82" y="43" font-size="31">杭海城际</text><text x="82" y="65" font-size="15" font-weight="600">Hangzhou-Haining</text><text x="82" y="83" font-size="15" font-weight="600">Intercity Rail</text></g>`
    : `<g fill="${sign.foreground}" font-family="Arial, Microsoft YaHei, sans-serif"><path d="${numeral.d}" transform="translate(${numeral.x} ${numeral.y})"/><text x="${wide ? 76 : 55}" y="61" font-size="22">号线</text><text x="${wide ? 76 : 55}" y="80" font-size="15">Line${wide ? '' : ' '}${id}</text></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="100" viewBox="0 0 ${width} 100" role="img" aria-label="${label}"><rect width="${width}" height="100" rx="4" fill="${sign.background}"/>${content}</svg>\n`;
  writeFileSync(new URL(`${id}.svg`, directory), svg);
}
console.log(`Generated ${Object.keys(colors).length} source-audited Hangzhou line signs.`);

