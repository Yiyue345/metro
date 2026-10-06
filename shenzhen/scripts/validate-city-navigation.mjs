import assert from 'node:assert/strict';
import { neighborEdge } from '../src/data/neighbor-navigation.mjs';

const viewport = { width: 800, height: 600 };
const home = { x: 400, y: 300 };
assert.equal(neighborEdge(viewport, { x: 400, y: -500 }, home, [{ x: 400, y: -300 }]), undefined);
assert.equal(neighborEdge(viewport, { x: 400, y: -500 }, { x: 400, y: 900 }, [{ x: 400, y: 100 }]).edge, 'top');
assert.equal(neighborEdge(viewport, { x: 400, y: 1100 }, { x: 400, y: -300 }, [{ x: 400, y: 500 }]).edge, 'bottom');
assert.equal(neighborEdge(viewport, { x: -300, y: 200 }, { x: 950, y: 300 }, [{ x: 60, y: 290 }]).edge, 'left');
assert.equal(neighborEdge(viewport, { x: 1200, y: 300 }, { x: -150, y: 300 }, [{ x: 740, y: 300 }]).edge, 'right');
const thresholdStation = [{ x: 400, y: 108 }];
assert.equal(neighborEdge(viewport, { x: 400, y: -500 }, home, thresholdStation), undefined);
assert.equal(neighborEdge(viewport, { x: 400, y: -500 }, home, thresholdStation, true).edge, 'top');
assert.equal(neighborEdge(viewport, home, home, []), undefined);
assert.equal(neighborEdge({ width: 0, height: 0 }, home, home, thresholdStation), undefined);

// A constrained viewport can reach its city boundary before its centre gets
// close to the neighboring network. The entry must still be available there.
const boundary = { left: 0, right: 800, top: 0, bottom: 600 };
assert.equal(neighborEdge(viewport, { x: 400, y: -500 }, home, thresholdStation, false, boundary).edge, 'top');
assert.equal(neighborEdge(viewport, { x: 400, y: -500 }, home, [{ x: 400, y: -300 }], false, boundary), undefined);
assert.equal(neighborEdge(viewport, { x: 400, y: -500 }, home, thresholdStation, false, { ...boundary, top: -100 }), undefined);
console.log('Validated neighbor reach, four edges, visibility hysteresis and entries at constrained city boundaries.');
