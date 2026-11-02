const TAU = Math.PI * 2;
const EPSILON = 1e-6;
const number = value => Number(value.toFixed(6));

/** The exposed circular arcs of a union, including its inward waist.
 * @param {{x: number, y: number, radius: number}[]} circles
 */
export function circleUnionPath(circles) {
  const arcs = [];
  for (const [index, circle] of circles.entries()) {
    if (circles.some((other, j) => j !== index
      && Math.hypot(other.x - circle.x, other.y - circle.y) + circle.radius <= other.radius + EPSILON
      && (other.radius > circle.radius || j < index))) continue;
    const cuts = [0, Math.PI, TAU];
    for (const [j, other] of circles.entries()) {
      if (j === index) continue;
      const dx = other.x - circle.x, dy = other.y - circle.y, distance = Math.hypot(dx, dy);
      if (distance >= circle.radius + other.radius || distance <= Math.abs(circle.radius - other.radius)) continue;
      const direction = Math.atan2(dy, dx);
      const spread = Math.acos(Math.max(-1, Math.min(1,
        (distance ** 2 + circle.radius ** 2 - other.radius ** 2) / (2 * distance * circle.radius))));
      cuts.push((direction - spread + TAU) % TAU, (direction + spread + TAU) % TAU);
    }
    const sorted = [...new Set(cuts)].sort((a, b) => a - b);
    const point = angle => ({ x: circle.x + circle.radius * Math.cos(angle), y: circle.y + circle.radius * Math.sin(angle) });
    for (let i = 1; i < sorted.length; i++) {
      const start = sorted[i - 1], end = sorted[i];
      if (end - start < EPSILON) continue;
      const middle = point((start + end) / 2);
      if (circles.some((other, j) => j !== index
        && Math.hypot(middle.x - other.x, middle.y - other.y) < other.radius - EPSILON)) continue;
      arcs.push({ start: point(start), end: point(end), radius: circle.radius, large: end - start > Math.PI ? 1 : 0 });
    }
  }
  return traceBoundary(arcs);
}

function traceBoundary(arcs) {
  const path = [];
  while (arcs.length) {
    let arc = arcs.shift();
    const first = arc.start;
    path.push(`M ${number(first.x)} ${number(first.y)}`);
    for (;;) {
      path.push(arc.radius
        ? `A ${number(arc.radius)} ${number(arc.radius)} 0 ${arc.large} 1 ${number(arc.end.x)} ${number(arc.end.y)}`
        : `L ${number(arc.end.x)} ${number(arc.end.y)}`);
      if (Math.hypot(arc.end.x - first.x, arc.end.y - first.y) < EPSILON) break;
      const next = arcs.findIndex(candidate => Math.hypot(candidate.start.x - arc.end.x, candidate.start.y - arc.end.y) < EPSILON);
      if (next < 0) throw new Error('Unclosed station symbol boundary');
      arc = arcs.splice(next, 1)[0];
    }
    path.push('Z');
  }
  return path.join(' ');
}

/** Exact union of circular and capsule parts, preserving straight capsule sides.
 * @param {{x: number, y: number, width: number, height: number, angle: number}[]} parts
 */
export function stationShapeUnionPath(parts) {
  if (parts.every(part => part.width === part.height)) {
    return circleUnionPath(parts.map(part => ({ x: part.x, y: part.y, radius: part.width / 2 })));
  }
  const shapes = parts.map(part => {
    const angle = part.angle * Math.PI / 180, half = (part.width - part.height) / 2;
    return { angle, radius: part.height / 2,
      a: { x: part.x - half * Math.cos(angle), y: part.y - half * Math.sin(angle) },
      b: { x: part.x + half * Math.cos(angle), y: part.y + half * Math.sin(angle) } };
  });
  const primitives = [];
  const addArc = (shape, center, radius, angle, sweep) => primitives.push({ shape, center, radius, angle, sweep,
    point: t => ({ x: center.x + radius * Math.cos(angle + sweep * t), y: center.y + radius * Math.sin(angle + sweep * t) }) });
  const addLine = (shape, a, b) => primitives.push({ shape, a, b,
    point: t => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }) });
  shapes.forEach((shape, index) => {
    const { a, b, radius, angle } = shape;
    if (Math.hypot(b.x - a.x, b.y - a.y) < EPSILON) {
      addArc(index, a, radius, 0, Math.PI); addArc(index, a, radius, Math.PI, Math.PI);
    } else {
      const nx = -Math.sin(angle) * radius, ny = Math.cos(angle) * radius;
      addArc(index, b, radius, angle - Math.PI / 2, Math.PI);
      addLine(index, { x: b.x + nx, y: b.y + ny }, { x: a.x + nx, y: a.y + ny });
      addArc(index, a, radius, angle + Math.PI / 2, Math.PI);
      addLine(index, { x: a.x - nx, y: a.y - ny }, { x: b.x - nx, y: b.y - ny });
    }
  });
  const parameter = (primitive, point) => {
    if (primitive.radius) {
      const angle = (Math.atan2(point.y - primitive.center.y, point.x - primitive.center.x) - primitive.angle + TAU * 2) % TAU;
      if (TAU - angle < EPSILON) return 0;
      return angle <= primitive.sweep + EPSILON ? Math.min(1, angle / primitive.sweep) : null;
    }
    const dx = primitive.b.x - primitive.a.x, dy = primitive.b.y - primitive.a.y;
    const t = ((point.x - primitive.a.x) * dx + (point.y - primitive.a.y) * dy) / (dx * dx + dy * dy);
    return t >= -EPSILON && t <= 1 + EPSILON ? Math.max(0, Math.min(1, t)) : null;
  };
  const intersections = (first, second) => {
    if (first.radius && second.radius) {
      const dx = second.center.x - first.center.x, dy = second.center.y - first.center.y, distance = Math.hypot(dx, dy);
      if (distance < EPSILON || distance > first.radius + second.radius || distance < Math.abs(first.radius - second.radius)) return [];
      const along = (first.radius ** 2 - second.radius ** 2 + distance ** 2) / (2 * distance);
      const across = Math.sqrt(Math.max(0, first.radius ** 2 - along ** 2));
      return [-1, 1].map(sign => ({ x: first.center.x + along * dx / distance - sign * across * dy / distance,
        y: first.center.y + along * dy / distance + sign * across * dx / distance }));
    }
    if (first.radius || second.radius) {
      const arc = first.radius ? first : second, line = first.radius ? second : first;
      const dx = line.b.x - line.a.x, dy = line.b.y - line.a.y, ox = line.a.x - arc.center.x, oy = line.a.y - arc.center.y;
      const a = dx * dx + dy * dy, b = 2 * (ox * dx + oy * dy), c = ox * ox + oy * oy - arc.radius ** 2;
      const discriminant = b * b - 4 * a * c;
      return discriminant < 0 ? [] : [-1, 1].map(sign => line.point((-b + sign * Math.sqrt(discriminant)) / (2 * a)));
    }
    const dx = first.b.x - first.a.x, dy = first.b.y - first.a.y;
    const ex = second.b.x - second.a.x, ey = second.b.y - second.a.y, cross = dx * ey - dy * ex;
    if (Math.abs(cross) < EPSILON) return [];
    return [first.point(((second.a.x - first.a.x) * ey - (second.a.y - first.a.y) * ex) / cross)];
  };
  const cuts = primitives.map(() => [0, 1]);
  for (let i = 0; i < primitives.length; i++) for (let j = i + 1; j < primitives.length; j++) {
    if (primitives[i].shape === primitives[j].shape) continue;
    for (const point of intersections(primitives[i], primitives[j])) {
      const a = parameter(primitives[i], point), b = parameter(primitives[j], point);
      if (a !== null && b !== null) { cuts[i].push(a); cuts[j].push(b); }
    }
  }
  const inside = (point, shape) => {
    const dx = shape.b.x - shape.a.x, dy = shape.b.y - shape.a.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - shape.a.x) * dx + (point.y - shape.a.y) * dy) / length)) : 0;
    return Math.hypot(point.x - shape.a.x - dx * t, point.y - shape.a.y - dy * t) < shape.radius - EPSILON;
  };
  const exposed = [];
  primitives.forEach((primitive, index) => {
    const sorted = [...new Set(cuts[index])].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if (b - a < EPSILON || shapes.some((shape, j) => j !== primitive.shape && inside(primitive.point((a + b) / 2), shape))) continue;
      exposed.push({ start: primitive.point(a), end: primitive.point(b), radius: primitive.radius,
        large: primitive.radius && primitive.sweep * (b - a) > Math.PI ? 1 : 0 });
    }
  });
  return traceBoundary(exposed);
}
