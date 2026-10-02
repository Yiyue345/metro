import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const colors = JSON.parse(readFileSync(new URL('../src/data/line-colors.json', import.meta.url), 'utf8'));
const directory = new URL('../public/lines/', import.meta.url);
mkdirSync(directory, { recursive: true });
for (const [id, color] of Object.entries(colors)) {
  const branch = id === '6b';
  const number = branch ? '6' : id;
  const chinese = branch ? '号线支线' : '号线';
  const english = branch ? 'Line 6 Branch' : `Line ${id}`;
  // Reconstructed from the user-supplied bilingual line sign, not an official asset.
  const doubleDigit = number.length > 1;
  const width = doubleDigit ? 245 : 200;
  const textX = doubleDigit ? 135 : 90;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="100" viewBox="0 0 ${width} 100" role="img" aria-label="${number}${chinese}"><rect width="${width}" height="100" rx="10" fill="${color}"/><g fill="white" font-family="Arial, Microsoft YaHei, sans-serif"><text x="${doubleDigit ? 70 : 45}" y="82" text-anchor="middle" font-size="87" font-weight="500">${number}</text><text x="${textX}" y="56" font-size="${branch ? 24 : 38}">${chinese}</text><text x="${textX + 1}" y="84" font-size="${branch ? 15 : 22}">${english}</text></g></svg>\n`;
  writeFileSync(new URL(`${id}.svg`, directory), svg);
}
console.log(`Generated ${Object.keys(colors).length} bilingual line signs.`);
