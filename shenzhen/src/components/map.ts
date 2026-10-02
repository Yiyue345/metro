import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { registerDiagram } from '../data/map-registration.mjs';
import type { MetroCityDataset } from '../data/metro-city';
interface Station { id: string; name: string; englishName: string; aliases?: string[]; status?: 'planned'; x: number; y: number; lines: string[] }
interface Line { id: string; name: string; color: string }
interface Coordinate { lat: number; lon: number }
declare global { interface Window { __metroData: Pick<MetroCityDataset, 'city' | 'stationNotes' | 'basemap' | 'operatorsByStation' | 'lineNames'> & { stations: Station[]; lines: Line[]; meta: { width: number; height: number }; visitedStations: string[]; coordinates: Record<string, Coordinate> } } }

const { stations, lines, meta, visitedStations, coordinates, city, stationNotes, basemap, operatorsByStation, lineNames } = window.__metroData;
function lineTitle(id: string, fallback = id) {
  const number = id === '6b' ? '6 号线支线' : /^\d+$/.test(id) ? `${id} 号线` : fallback;
  return lineNames[id] ? `${number} / ${lineNames[id]}` : number;
}
const svg = document.querySelector<SVGSVGElement>('#metro-map')!;
const workspace = document.querySelector<HTMLElement>('.map-workspace')!;
const search = document.querySelector<HTMLInputElement>('#station-search')!;
const results = document.querySelector<HTMLElement>('#search-results')!;
const card = document.querySelector<HTMLElement>('#station-card')!;
const tooltip = document.querySelector<HTMLElement>('#map-tooltip')!;
const nodes = [...svg.querySelectorAll<SVGGElement>('.station-hotspot')];
const routeNodes = [...svg.querySelectorAll<SVGGElement>('[data-route]')];
const labelNodes = [...svg.querySelectorAll<SVGTextElement>('[data-label]')];
const stationById = new Map(stations.map(s => [String(s.id), s]));
const lineById = new Map(lines.map(l => [String(l.id), l]));
const geographicBounds = city.geographicBounds;
const visited = new Set(visitedStations);
const geographicContainer = document.querySelector<HTMLElement>('#geographic-map')!;
geographicContainer.setAttribute('aria-label', `${city.name}地铁地图；矢量线网整体等比叠加到底图`);
const mapStatus = document.querySelector<HTMLElement>('#map-status')!;
let geographicMap: MapLibreMap | undefined;
let geographicLoad: Promise<void> | undefined;
let geographicTileFailed = false;
const geographicMarkers = new Map<string, SVGGElement>();
let geographicOverlay: SVGSVGElement | undefined;
const registration = registerDiagram(stations, coordinates, meta.width);
const geographicCoordinates: Record<string, Coordinate> = registration.stationCoordinates;
const geographicMode = () => workspace.dataset.mapMode === 'geographic';
const coordinateFor = (id: string) => {
  const coordinate = geographicCoordinates[id];
  return coordinate && Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lon)
    && Math.abs(coordinate.lat) <= 90 && Math.abs(coordinate.lon) <= 180 ? coordinate : undefined;
};
let stationsInteractive = false;
let selected: string | null = null;
let activeLine: string | null = null;
let view = { x: 0, y: 0, width: meta.width, height: meta.height };
let fitWidth = meta.width;
let dragMoved = false;
let suppressClickUntil = 0;
const pointers = new Map<number, { x: number; y: number }>();
let gesture: { view: typeof view; center: { x: number; y: number }; distance: number; count: number } | null = null;
const minimumWidth = () => Math.min(fitWidth, svg.clientWidth * .65);

function updateVisitState() {
  nodes.forEach(node => node.classList.toggle('visited', visited.has(node.dataset.station!)));
  document.querySelector<HTMLElement>('#station-visit-status')!.hidden = !selected || !visited.has(selected);
  updateGeographicMarkers();
}
function updateLocationStatus() {
  const status = document.querySelector<HTMLElement>('#station-location-status')!;
  const station = selected ? stationById.get(selected) : undefined;
  const messages: string[] = [];
  if (station?.status === 'planned') messages.push('未开通');
  if (selected && geographicMode() && !coordinates[selected]) messages.push('暂无已核实的经纬度');
  status.textContent = messages.join(' · ');
  status.hidden = !messages.length;
}
function updateGeographicMarkers() {
  if (!geographicMap) return;
  const interactive = geographicMap.getZoom() >= 13;
  geographicContainer.classList.toggle('stations-disabled', !interactive);
  geographicContainer.classList.toggle('stations-compact', geographicMap.getZoom() < 12);
  geographicMarkers.forEach((element, id) => {
    const station = stationById.get(id)!;
    const included = !activeLine || station.lines.includes(activeLine);
    element.classList.toggle('excluded', !included);
    element.classList.toggle('visited', visited.has(id));
    element.classList.toggle('selected', selected === id);
    element.tabIndex = interactive && included ? 0 : -1;
    element.setAttribute('aria-disabled', String(!interactive || !included));
  });
}
function updateGeographicLines() {
  geographicOverlay?.querySelectorAll<SVGGElement>('[data-route]').forEach(route => {
    route.classList.toggle('dimmed', !!activeLine && route.dataset.route !== activeLine);
  });
  geographicOverlay?.querySelectorAll<SVGTextElement>('[data-label]').forEach(label => {
    label.classList.toggle('dimmed', !!activeLine && !stationById.get(label.dataset.label!)?.lines.includes(activeLine));
  });
}
function positionGeographicOverlay() {
  if (!geographicMap || !geographicOverlay) return;
  const origin = geographicMap.project([registration.origin.lon, registration.origin.lat]);
  const east = geographicMap.project([registration.east.lon, registration.east.lat]);
  const scale = (east.x - origin.x) / meta.width;
  geographicOverlay.style.transform = `translate(${origin.x}px, ${origin.y}px) scale(${scale})`;

}
function createGeographicOverlay() {
  // Copy the exact SVG geometry and typography, retaining every internal ratio.
  const overlay = svg.cloneNode(true) as SVGSVGElement;
  overlay.id = 'geographic-diagram';
  overlay.removeAttribute('hidden');
  overlay.removeAttribute('tabindex');
  overlay.setAttribute('viewBox', `0 0 ${meta.width} ${meta.height}`);
  overlay.style.width = `${meta.width}px`;
  overlay.style.height = `${meta.height}px`;
  overlay.querySelector('.geography-layer')?.remove();
  overlay.querySelectorAll<SVGElement>('[id]').forEach(element => {
    const original = element.id;
    element.id = `geographic-${original}`;
    overlay.querySelectorAll<SVGElement>('[fill]').forEach(shape => {
      if (shape.getAttribute('fill') === `url(#${original})`) shape.setAttribute('fill', `url(#${element.id})`);
    });
  });
  overlay.querySelectorAll<SVGGElement>('.station-hotspot').forEach(element => {
    const id = element.dataset.station!;
    element.addEventListener('click', () => {
      if (!geographicMap!.isMoving() && element.getAttribute('aria-disabled') === 'false') selectStation(id);
    });
    element.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && element.getAttribute('aria-disabled') === 'false') {
        event.preventDefault(); selectStation(id);
      }
    });
    geographicMarkers.set(id, element);
  });
  // Interaction gating belongs to the map's zoom, not the copied vector view.
  overlay.classList.remove('stations-disabled');
  geographicMap!.getCanvasContainer().append(overlay);
  geographicOverlay = overlay;
  positionGeographicOverlay();
  updateGeographicLines();
}
function renderGeographicControls() {
  if (!geographicMap || !geographicMode()) return;
  const level = geographicMap.getZoom();
  document.querySelector('#zoom-level')!.textContent = `Z${Math.round(level)}`;
  document.querySelector<HTMLButtonElement>('#zoom-in')!.disabled = level >= geographicMap.getMaxZoom();
  document.querySelector<HTMLButtonElement>('#zoom-out')!.disabled = level <= geographicMap.getMinZoom();
  updateGeographicMarkers();
}
function resetGeographicMap() {
  if (!geographicMap) return;
  // Recompute after a resize; maxBounds constrains the whole viewport.
  geographicMap.setMinZoom(0);
  const points = stations.flatMap(station => {
    const point = coordinateFor(station.id);
    return point ? [[point.lon, point.lat] as [number, number]] : [];
  });
  if (points.length) {
    const west = Math.min(...points.map(point => point[0]));
    const east = Math.max(...points.map(point => point[0]));
    const south = Math.min(...points.map(point => point[1]));
    const north = Math.max(...points.map(point => point[1]));
    const camera = geographicMap.cameraForBounds([[west, south], [east, north]], { padding: 40, maxZoom: 12 });
    if (camera) {
      geographicMap.jumpTo(camera);
    }
  } else geographicMap.jumpTo({ center: city.center, zoom: 11 });
  geographicMap.setMinZoom(geographicMap.getZoom());
  renderGeographicControls();
}
function updateGeographicExtent() {
  if (!geographicMap) return;
  const atOverview = geographicMap.getZoom() <= geographicMap.getMinZoom() + .4;
  const current = geographicMap.getCenter();
  const zoom = geographicMap.getZoom();
  resetGeographicMap();
  if (!atOverview) geographicMap.jumpTo({ center: current, zoom });
}
async function loadGeographicMap() {
  if (geographicMap) {
    geographicMap.resize();
    mapStatus.hidden = !geographicTileFailed;
    renderGeographicControls();
    return;
  }
  if (!geographicLoad) {
    mapStatus.textContent = '地图加载中…';
    mapStatus.hidden = false;
    geographicLoad = (async () => {
      const [{ default: maplibregl }, { osm, inlineSources }] = await Promise.all([
        import('maplibre-gl'), import('@versatiles/style'),
      ]);
      const style = await inlineSources(osm({
        theme: basemap.theme as 'muted',
        projection: 'mercator',
        sky: false,
        features: { buildings: 'flat', terrain: false, hillshade: false },
        colors: {
          background: '#ffffff', water: '#6da9e5',
          natureWood: '#59e19d', natureGrass: '#59e19d', naturePark: '#59e19d', natureLeisure: '#59e19d',
          areaResidential: '#ffffff', areaCommercial: '#ffffff', areaIndustrial: '#ffffff',
          building: '#e4e6e5', buildingBg: '#f0f1f0',
          roadStreet: '#e3e5e4', roadStreetBg: '#f5f6f5',
          roadMotorway: '#d4d9d7', roadMotorwayBg: '#f3f4f3',
          roadTrunk: '#dce0de', roadTrunkBg: '#f4f5f4',
          label: '#333a36', labelHalo: '#ffffff',
        },
        layers: { roads: { paths: false, footway: false, steps: false }, pois: false, markings: false, transit: false, buildings: true, sites: false, airport: false, boundaries: false, land: { urban: false, agriculture: false }, labels: { streets: false, addresses: false } },
        urls: { base: basemap.base, osm: basemap.tileset },
      }));
      for (const layer of style.layers) {
        if (layer.type === 'line' && layer.id.includes('street-')) {
          const major = /motorway|trunk|primary/.test(layer.id);
          layer.minzoom = Math.max(layer.minzoom ?? 0, major ? 10 : 12);
          layer.paint = { ...layer.paint, 'line-opacity': .55 };
        }
      }
      if (!geographicMode()) return;
      geographicMap = new maplibregl.Map({
        container: geographicContainer,
        style: style as unknown as StyleSpecification,
        center: city.center,
        zoom: 11,
        minZoom: 0,
        maxZoom: basemap.maxZoom,
        maxBounds: geographicBounds,
        dragRotate: false,
        touchPitch: false,
        pitchWithRotate: false,
        attributionControl: false,
      });
      geographicMap.touchZoomRotate.disableRotation();
      geographicMap.keyboard.disableRotation();
      geographicMap.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: basemap.attribution }), 'bottom-right');
      geographicMap.on('error', event => {
        if (!geographicTileFailed) console.error('真实地图资源加载失败', event.error);
        geographicTileFailed = true;
        mapStatus.textContent = '底图加载失败，请检查网络连接';
        mapStatus.hidden = !geographicMode();
      });
      geographicMap.on('zoom', renderGeographicControls);
      geographicMap.on('move', positionGeographicOverlay);
      geographicMap.on('resize', updateGeographicExtent);
      geographicMap.on('load', () => { mapStatus.hidden = !geographicTileFailed; });
      createGeographicOverlay();
      resetGeographicMap();
      const selectedPoint = selected ? coordinateFor(selected) : undefined;
      if (selectedPoint) geographicMap.jumpTo({ center: [selectedPoint.lon, selectedPoint.lat], zoom: basemap.maxZoom });
      renderGeographicControls();
    })().catch(error => {
      console.error('真实地图初始化失败', error);
      try { geographicMap?.remove(); }
      catch { /* Keep the original initialization error and restore retry state. */ }
      geographicMap = undefined;
      geographicMarkers.clear();
      geographicOverlay = undefined;
      mapStatus.textContent = '地图加载失败，请重试';
      mapStatus.hidden = !geographicMode();
    }).finally(() => { geographicLoad = undefined; });
  }
  await geographicLoad;
}
function updateStationInteraction() {
  stationsInteractive = svg.clientWidth / view.width >= .6;
  svg.classList.toggle('stations-disabled', !stationsInteractive);
  nodes.forEach(node => {
    const enabled = stationsInteractive && !node.classList.contains('excluded');
    node.setAttribute('tabindex', enabled ? '0' : '-1');
    node.setAttribute('aria-disabled', String(!enabled));
    if (!enabled && document.activeElement === node) svg.focus({ preventScroll: true });
  });
  if (!stationsInteractive) tooltip.hidden = true;
}

function boundView() {
  view.x = view.width >= meta.width ? (meta.width - view.width) / 2 : Math.max(0, Math.min(meta.width - view.width, view.x));
  view.y = view.height >= meta.height ? (meta.height - view.height) / 2 : Math.max(0, Math.min(meta.height - view.height, view.y));
}
function render() {
  if (geographicMode()) { renderGeographicControls(); return; }
  boundView();
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
  updateStationInteraction();
  document.querySelector('#zoom-level')!.textContent = `${Math.round(fitWidth / view.width * 100)}%`;
  document.querySelector<HTMLButtonElement>('#zoom-in')!.disabled = view.width <= minimumWidth() + .1;
  document.querySelector<HTMLButtonElement>('#zoom-out')!.disabled = view.width >= fitWidth - .1;
}
function fit() {
  const aspect = workspace.clientWidth / workspace.clientHeight;
  const width = Math.max(meta.width, meta.height * aspect);
  fitWidth = width;
  view = { x: (meta.width - width) / 2, y: (meta.height - width / aspect) / 2, width, height: width / aspect };
  render();
}
function zoom(factor: number, clientX = svg.clientWidth / 2, clientY = svg.clientHeight / 2) {
  const width = Math.max(minimumWidth(), Math.min(fitWidth, view.width / factor));
  const relativeX = clientX / svg.clientWidth;
  const relativeY = clientY / svg.clientHeight;
  const height = width * svg.clientHeight / svg.clientWidth;
  view = { x: view.x + (view.width - width) * relativeX, y: view.y + (view.height - height) * relativeY, width, height };
  tooltip.hidden = true;
  render();
}
function closeCard() {
  card.hidden = true;
  selected = null;
  nodes.forEach(n => n.classList.remove('selected'));
  updateVisitState();
  updateLocationStatus();
}
function selectStation(id: string, locate = false) {
  const station = stationById.get(id);
  if (!station) return;
  selected = id;
  nodes.forEach(n => n.classList.toggle('selected', n.dataset.station === id));
  document.querySelector('#station-name')!.textContent = station.name;
  document.querySelector('#station-english')!.textContent = station.englishName;
  const note = document.querySelector<HTMLElement>('#station-note')!;
  note.textContent = (stationNotes as Record<string, string>)[id]?.trim() ?? '';
  note.hidden = !note.textContent;
  const tags = document.querySelector('#station-lines')!;
  tags.replaceChildren(...station.lines.map(lineId => {
    const line = lineById.get(String(lineId));
    const image = document.createElement('img');
    image.className = 'line-badge';
    image.src = `${city.assetBase}/lines/${lineId}.svg`;
    image.alt = lineTitle(String(lineId), line?.name);
    image.title = image.alt;
    image.width = /^\d{2}$/.test(lineId) ? 245 : 200;
    image.height = 100;
    return image;
  }));
  const operatorList = document.querySelector<HTMLElement>('#station-operators')!;
  const stationCompanies = operatorsByStation[station.id] ?? [];
  operatorList.hidden = !stationCompanies.length;
  operatorList.replaceChildren(...stationCompanies.map(operator => {
    const link = document.createElement('a');
    link.href = operator.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = operator.company;
    link.dataset.operator = operator.id;
    if (operator.logo) {
      const image = document.createElement('img');
      image.src = operator.logo;
      image.alt = operator.name;
      link.append(image);
    } else link.textContent = operator.name;
    return link;
  }));
  card.hidden = false;
  updateVisitState();
  updateLocationStatus();
  tooltip.hidden = true;
  results.hidden = true;
  if (locate) {
    filterLine(null);
    if (geographicMode()) {
      const point = coordinateFor(id);
      if (point) geographicMap?.jumpTo({ center: [point.lon, point.lat], zoom: basemap.maxZoom });
      search.blur();
      return;
    }
    const width = Math.min(fitWidth, svg.clientWidth * 1.1);
    const height = width * svg.clientHeight / svg.clientWidth;
    view = { x: station.x - width / 2, y: station.y - height / 2, width, height };
    render();
    search.blur();
  }
}
function filterLine(id: string | null) {
  activeLine = id;
  const line = id ? lineById.get(id) : undefined;
  nodes.forEach(node => {
    const station = stationById.get(node.dataset.station!);
    const included = !id || !!station?.lines.some(value => String(value) === id);
    node.classList.toggle('filtered', !!id && included);
    node.classList.toggle('excluded', !included);
    node.style.setProperty('--station-color', line?.color ?? '#245c43');
  });
  document.querySelectorAll<HTMLButtonElement>('.line-choice').forEach(button => {
    const active = (button.dataset.line ?? null) === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector('#line-count')!.textContent = line?.name ?? '全部';
  routeNodes.forEach(route => route.classList.toggle('dimmed', !!id && route.dataset.route !== id));
  labelNodes.forEach(label => {
    const station = stationById.get(label.dataset.label!);
    label.classList.toggle('dimmed', !!id && !station?.lines.some(value => String(value) === id));
  });
  if (selected && id && !stationById.get(selected)?.lines.some(value => String(value) === id)) closeCard();
  updateStationInteraction();
  updateGeographicMarkers();
  updateGeographicLines();
}

svg.addEventListener('wheel', event => {
  event.preventDefault();
  const rect = svg.getBoundingClientRect();
  zoom(Math.exp(-event.deltaY * 0.0018), event.clientX - rect.left, event.clientY - rect.top);
}, { passive: false });
function pointerMetrics() {
  const values = [...pointers.values()];
  const center = values.length > 1 ? { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 } : values[0];
  const distance = values.length > 1 ? Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y) : 0;
  return { center, distance };
}
function beginGesture() {
  if (!pointers.size) { gesture = null; return; }
  gesture = { view: { ...view }, ...pointerMetrics(), count: pointers.size };
}
svg.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) dragMoved = false;
  beginGesture();
  svg.setPointerCapture(event.pointerId);
  svg.classList.add('dragging');
});
svg.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId) || !gesture) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const metrics = pointerMetrics();
  const dx = metrics.center.x - gesture.center.x;
  const dy = metrics.center.y - gesture.center.y;
  if (Math.hypot(dx, dy) > 4 || pointers.size > 1) { dragMoved = true; tooltip.hidden = true; }
  const ratio = pointers.size > 1 && gesture.distance > 0 ? metrics.distance / gesture.distance : 1;
  const width = Math.max(minimumWidth(), Math.min(fitWidth, gesture.view.width / ratio));
  const height = width * svg.clientHeight / svg.clientWidth;
  const rect = svg.getBoundingClientRect();
  const centerX = (gesture.center.x - rect.left) / rect.width;
  const centerY = (gesture.center.y - rect.top) / rect.height;
  view = {
    x: gesture.view.x + (gesture.view.width - width) * centerX - dx * width / rect.width,
    y: gesture.view.y + (gesture.view.height - height) * centerY - dy * height / rect.height,
    width, height,
  };
  render();
});
function endPointer(event: PointerEvent) {
  const wasGesture = pointers.has(event.pointerId);
  pointers.delete(event.pointerId);
  if (dragMoved) suppressClickUntil = performance.now() + 250;
  if (wasGesture && !dragMoved && event.type === 'pointerup') {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<SVGGElement>('[data-station]');
    if (stationsInteractive && target?.dataset.station && !target.classList.contains('excluded')) selectStation(target.dataset.station);
  }
  beginGesture();
  if (!pointers.size) svg.classList.remove('dragging');
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
nodes.forEach(node => {
  node.addEventListener('focus', () => {
    const station = stationById.get(node.dataset.station!);
    if (station && (station.x < view.x || station.x > view.x + view.width || station.y < view.y || station.y > view.y + view.height)) {
      view.x = station.x - view.width / 2;
      view.y = station.y - view.height / 2;
      render();
    }
  });
  node.addEventListener('click', event => {
    if (stationsInteractive && !node.classList.contains('excluded') && event.detail === 0 && performance.now() > suppressClickUntil) selectStation(node.dataset.station!);
  });
  node.addEventListener('keydown', event => {
    if (stationsInteractive && !node.classList.contains('excluded') && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectStation(node.dataset.station!); }
  });
  node.addEventListener('pointerenter', () => {
    if (pointers.size || !stationsInteractive || node.classList.contains('excluded')) return;
    const station = stationById.get(node.dataset.station!);
    if (!station) return;
    const rect = workspace.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    tooltip.textContent = station.name;
    tooltip.style.left = `${Math.max(40, Math.min(rect.width - 40, nodeRect.left + nodeRect.width / 2 - rect.left))}px`;
    tooltip.style.top = `${Math.max(30, nodeRect.top - rect.top - 8)}px`;
    tooltip.hidden = false;
  });
  node.addEventListener('pointerleave', () => tooltip.hidden = true);
});
search.addEventListener('input', () => {
  const query = search.value.trim();
  results.replaceChildren();
  if (!query) { results.hidden = true; return; }
  const matches = stations.filter(s => s.name.includes(query) || s.englishName.toLowerCase().includes(query.toLowerCase()) || s.aliases?.some(alias => alias.includes(query))).sort((a, b) => Number(b.name === query) - Number(a.name === query)).slice(0, 12);
  matches.forEach(station => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result';
    button.textContent = station.name;
    const dots = document.createElement('span');
    dots.className = 'result-line';
    station.lines.forEach(id => { const dot = document.createElement('i'); dot.style.background = lineById.get(String(id))?.color ?? '#67736e'; dots.append(dot); });
    button.append(dots);
    button.addEventListener('click', () => { search.value = station.name; selectStation(String(station.id), true); });
    results.append(button);
  });
  if (!matches.length) { const empty = document.createElement('div'); empty.className = 'search-empty'; empty.textContent = '没有找到这个站点'; results.append(empty); }
  results.hidden = false;
});
search.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector<HTMLButtonElement>('button')?.focus(); }
  if (event.key === 'Enter') results.querySelector<HTMLButtonElement>('button')?.click();
});
results.addEventListener('keydown', event => {
  const buttons = [...results.querySelectorAll<HTMLButtonElement>('button')];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === 'ArrowDown') { event.preventDefault(); buttons[(index + 1) % buttons.length]?.focus(); }
  if (event.key === 'ArrowUp') { event.preventDefault(); if (index <= 0) search.focus(); else buttons[index - 1]?.focus(); }
});
document.querySelectorAll<HTMLButtonElement>('[data-line]').forEach(button => button.addEventListener('click', () => filterLine(activeLine === button.dataset.line ? null : button.dataset.line!)));
document.querySelector('#all-lines')!.addEventListener('click', () => filterLine(null));
document.querySelectorAll<HTMLButtonElement>('[data-map-view]').forEach(button => button.addEventListener('click', () => {
  workspace.dataset.mapMode = button.dataset.mapView;
  const geographic = geographicMode();
  svg.toggleAttribute('hidden', geographic);
  geographicContainer.hidden = !geographic;
  mapStatus.hidden = true;
  updateLocationStatus();
  if (geographic) void loadGeographicMap();
  else render();
  document.querySelectorAll<HTMLButtonElement>('[data-map-view]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
  tooltip.hidden = true;
}));
document.querySelector('#close-card')!.addEventListener('click', closeCard);
document.querySelector('#zoom-in')!.addEventListener('click', () => geographicMode() ? geographicMap?.zoomIn() : zoom(1.5));
document.querySelector('#zoom-out')!.addEventListener('click', () => geographicMode() ? geographicMap?.zoomOut() : zoom(1 / 1.5));
document.querySelector('#reset-map')!.addEventListener('click', () => geographicMode() ? resetGeographicMap() : fit());

document.addEventListener('pointerdown', event => { if (!(event.target as Element).closest('.search-panel')) results.hidden = true; });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeCard(); results.hidden = true; tooltip.hidden = true; }
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes((event.target as Element).tagName)) { event.preventDefault(); search.focus(); }
  if (event.target === svg) {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.5); }
    if (event.key === '-') { event.preventDefault(); zoom(1 / 1.5); }
    if (event.key === '0') { event.preventDefault(); fit(); }
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (direction) { event.preventDefault(); view.x += direction[0] * view.width * .1; view.y += direction[1] * view.height * .1; render(); }
  }
});
new ResizeObserver(() => {
  if (!svg.clientWidth || !svg.clientHeight) return;
  const zoomRatio = fitWidth / view.width;
  const center = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  const aspect = svg.clientWidth / svg.clientHeight;
  fitWidth = Math.max(meta.width, meta.height * aspect);
  const width = zoomRatio > 1.05 ? Math.max(minimumWidth(), Math.min(fitWidth, fitWidth / zoomRatio)) : fitWidth;
  const height = width / aspect;
  view = {
    x: (zoomRatio > 1.05 ? center.x : meta.width / 2) - width / 2,
    y: (zoomRatio > 1.05 ? center.y : meta.height / 2) - height / 2,
    width, height,
  };
  render();
}).observe(svg);
updateVisitState();
fit();
if (geographicMode()) void loadGeographicMap();
