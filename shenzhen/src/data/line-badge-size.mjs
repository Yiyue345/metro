import { readFileSync } from 'node:fs';
import badgeColors from './line-badge-colors.json' with { type: 'json' };

// Reserve the asset's own proportions before loading, for both menus and cards.
export function lineBadgeSize(cityId, lineId) {
  if (!['shenzhen', 'chengdu', 'dongguan', 'hangzhou', 'kunming', 'nanning', 'shaoxing'].includes(cityId)
    || !/^[a-z0-9-]+$/i.test(lineId)) throw new Error('Invalid line badge asset');
  const source = readFileSync(new URL(`../../../${cityId}/public/lines/${lineId}.svg`, import.meta.url), 'utf8');
  const root = source.match(/<svg\b[^>]*>/s)?.[0] ?? '';
  const box = root.match(/\bviewBox\s*=\s*["']([^"']+)["']/)?.[1].trim().split(/[\s,]+/).map(Number);
  const width = box?.[2] ?? Number(root.match(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/)?.[1]);
  const height = box?.[3] ?? Number(root.match(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/)?.[1]);
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error(`Invalid line badge size: ${cityId}/${lineId}`);
  return { width, height, color: badgeColors[cityId][lineId].color };
}
