import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const colors = JSON.parse(readFileSync(new URL('../data/line-colors.json', import.meta.url), 'utf8'));
const research = JSON.parse(readFileSync(new URL('./line-sign-research.json', import.meta.url), 'utf8'));
const directory = new URL('../public/lines/', import.meta.url);
mkdirSync(directory, { recursive: true });
for (const id of Object.keys(colors)) {
  const sign = research.lines.find((line) => line.id === id);
  if (!sign) throw new Error(`Missing line-sign research for ${id}`);
  // The operator's map uses an outlined white square and only a coloured numeral.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" role="img" aria-label="绍兴${id}号线"><rect x="2" y="2" width="96" height="96" rx="6" fill="white" stroke="${sign.foreground}" stroke-width="4"/><text x="50" y="81" text-anchor="middle" fill="${sign.foreground}" font-family="Arial, sans-serif" font-size="86" font-weight="400">${id}</text></svg>\n`;
  writeFileSync(new URL(`${id}.svg`, directory), svg);
}
console.log(`Generated ${Object.keys(colors).length} source-audited Shaoxing line signs.`);
