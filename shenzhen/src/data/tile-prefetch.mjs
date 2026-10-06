/** Nearby XYZ tiles only; never preload an entire city or visible tiles. */
export function surroundingTileUrls(source, bounds, zoom, limit = 16) {
  const template = source.tiles?.[0];
  if (!template || !['{z}', '{x}', '{y}'].every(token => template.includes(token))
    || ![...bounds, zoom, limit].every(Number.isFinite) || limit <= 0) return [];
  const z = Math.max(source.minzoom ?? 0, Math.min(source.maxzoom ?? 14, Math.floor(zoom)));
  const size = 2 ** z;
  const clamp = n => Math.max(0, Math.min(size - 1, Math.floor(n)));
  const tileX = lon => clamp((lon + 180) / 360 * size);
  const tileY = lat => {
    const radians = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
    return clamp((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * size);
  };
  const [west, south, east, north] = bounds;
  if (west > east || south > north) return [];
  const left = tileX(west), right = tileX(east), top = tileY(north), bottom = tileY(south);
  const tiles = [];
  const add = (x, y) => { if (x >= 0 && x < size && y >= 0 && y < size) tiles.push({ x, y }); };
  for (let x = left - 1; x <= right + 1; x++) { add(x, top - 1); add(x, bottom + 1); }
  for (let y = top; y <= bottom; y++) { add(left - 1, y); add(right + 1, y); }
  const cx = (left + right) / 2, cy = (top + bottom) / 2;
  return tiles.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
    .slice(0, Math.min(16, Math.floor(limit))).map(({ x, y }) => template
      .replaceAll('{z}', String(z)).replaceAll('{x}', String(x))
      .replaceAll('{y}', String(source.scheme === 'tms' ? size - 1 - y : y)));
}
