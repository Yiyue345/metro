// Keep straight corridors exact; round only the joins between them.
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export function closestPoint(point, points) {
  let best = { distance: Infinity, point: points[0], index: 0, t: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const projected = mix(a, b, t);
    const distance = Math.hypot(point[0] - projected[0], point[1] - projected[1]);
    if (distance < best.distance) best = { distance, point: projected, index: i, t };
  }
  return best;
}

export function simplify(points, tolerance = 2.5) {
  if (points.length < 3) return points;
  let distance = 0, split = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const candidate = closestPoint(points[i], [points[0], points.at(-1)]).distance;
    if (candidate > distance) { distance = candidate; split = i; }
  }
  return distance <= tolerance ? [points[0], points.at(-1)]
    : [...simplify(points.slice(0, split + 1), tolerance).slice(0, -1), ...simplify(points.slice(split), tolerance)];
}

export function roundedSegments(points, radius) {
  const segments = [];
  let start = points[0];
  const line = end => {
    if (Math.hypot(end[0] - start[0], end[1] - start[1]) > 1e-8) {
      segments.push([start, mix(start, end, 1 / 3), mix(start, end, 2 / 3), end]);
    }
    start = end;
  };
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1], corner = points[i], after = points[i + 1];
    const incoming = Math.hypot(corner[0] - before[0], corner[1] - before[1]);
    const outgoing = Math.hypot(after[0] - corner[0], after[1] - corner[1]);
    const trim = Math.min(radius, incoming * .3, outgoing * .3);
    const entry = mix(corner, before, trim / incoming);
    const exit = mix(corner, after, trim / outgoing);
    line(entry);
    segments.push([entry, mix(entry, corner, 2 / 3), mix(exit, corner, 2 / 3), exit]);
    start = exit;
  }
  line(points.at(-1));
  return segments;
}

export function sampleSegments(segments, spacing) {
  const result = [segments[0][0]];
  for (const [a, b, c, d] of segments) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) + Math.hypot(d[0] - c[0], d[1] - c[1]);
    const steps = Math.max(2, Math.ceil(length / spacing));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      result.push(a.map((v, axis) => u ** 3 * v + 3 * u ** 2 * t * b[axis] + 3 * u * t ** 2 * c[axis] + t ** 3 * d[axis]));
    }
  }
  return result;
}

export function svgPath(segments) {
  const format = p => p.map(v => v.toFixed(4)).join(',');
  return `M ${format(segments[0][0])}` + segments.map(s => ` C ${s.slice(1).map(format).join(' ')}`).join('');
}
