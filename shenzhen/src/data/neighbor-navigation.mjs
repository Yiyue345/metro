/** @param {{ lon: number; lat: number }[]} coordinates
 * @returns {[[number, number], [number, number]]} */
export function networkBounds(coordinates) {
  return [
    [Math.min(...coordinates.map(point => point.lon)), Math.min(...coordinates.map(point => point.lat))],
    [Math.max(...coordinates.map(point => point.lon)), Math.max(...coordinates.map(point => point.lat))],
  ];
}

/** A nearby station must enter the viewport margin, and the camera must be
 * closer to that network than to the home city's centre. Hysteresis prevents
 * the button flickering while dragging around the threshold.
 * @param {{ width: number; height: number }} viewport
 * @param {{ x: number; y: number }} focus
 * @param {{ x: number; y: number }} home
 * @param {{ x: number; y: number }[]} stations
 * @param {boolean} wasVisible
 * @param {{ left: number; right: number; top: number; bottom: number } | undefined} boundary */
export function neighborEdge(viewport, focus, home, stations, wasVisible = false, boundary = undefined) {
  const { width, height } = viewport;
  if (width <= 0 || height <= 0 || !stations.length) return undefined;
  const center = { x: width / 2, y: height / 2 };
  const distance = point => Math.hypot(point.x - center.x, point.y - center.y);
  const margin = Math.min(width, height) * .2;
  const nearby = stations.filter(point => point.x >= -margin && point.x <= width + margin
    && point.y >= -margin && point.y <= height + margin);
  const dx = focus.x - center.x, dy = focus.y - center.y;
  const horizontal = Math.abs(dx / width) > Math.abs(dy / height);
  const edge = horizontal ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'top' : 'bottom');
  const reach = distance(home) * .85 + Math.min(width, height) * .3 + (wasVisible ? 30 : 0);
  const gap = boundary ? { left: Math.abs(boundary.left), right: Math.abs(boundary.right - width),
    top: Math.abs(boundary.top), bottom: Math.abs(boundary.bottom - height) }[edge] : Infinity;
  const atBoundary = gap < (wasVisible ? 90 : 60);
  if (!nearby.length || (!atBoundary && Math.min(...nearby.map(distance)) > reach)) return undefined;
  const ratio = horizontal ? dy / (Math.abs(dx) || 1) * width / height : dx / (Math.abs(dy) || 1) * height / width;
  return { edge, position: Math.max(25, Math.min(75, (1 + ratio) * 50)) };
}
