import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const colors = JSON.parse(readFileSync(new URL('../data/line-colors.json', import.meta.url), 'utf8'));
const directory = new URL('../public/lines/', import.meta.url);
mkdirSync(directory, { recursive: true });
for (const [id, color] of Object.entries(colors)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100" role="img" aria-label="${id}号线"><rect width="200" height="100" rx="10" fill="${color}"/><g fill="white" font-family="Arial, Microsoft YaHei, sans-serif"><text x="45" y="82" text-anchor="middle" font-size="87" font-weight="500">${id}</text><text x="90" y="56" font-size="38">号线</text><text x="91" y="84" font-size="22">Line ${id}</text></g></svg>\n`;
  writeFileSync(new URL(`${id}.svg`, directory), svg);
}
console.log(`Generated ${Object.keys(colors).length} bilingual line signs.`);
