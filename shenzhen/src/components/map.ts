import type { Map as MapLibreMap, StyleSpecification, CameraOptions, Subscription } from 'maplibre-gl';
import { registerDiagram } from '../data/map-registration.mjs';
import { networkBounds, neighborEdge } from '../data/neighbor-navigation.mjs';
import type { NeighborCity } from '../data/neighbor-cities';
import type { MetroCityDataset } from '../data/metro-city';
interface Station { id: string; name: string; englishName: string; aliases?: string[]; status?: 'planned'; x: number; y: number; lines: string[] }
interface Line { id: string; name: string; color: string }
interface Coordinate { lat: number; lon: number }
declare global { interface Window { __metroData: Pick<MetroCityDataset, 'city' | 'stationNotes' | 'basemap' | 'operatorsByStation' | 'lineNames' | 'transportTransfers'> & { stations: Station[]; lines: Line[]; meta: { width: number; height: number }; visitedStations: string[]; coordinates: Record<string, Coordinate>; neighbors: NeighborCity[] } } }

type MetroPayload = Window['__metroData'];

function mountCity(data: MetroPayload, existingMap?: MapLibreMap, initialCamera?: CameraOptions) {
  const lifecycle = new AbortController();
  const subscriptions: Subscription[] = [];
  function listen<K extends keyof GlobalEventHandlersEventMap>(target: EventTarget, type: K,
    listener: (event: GlobalEventHandlersEventMap[K]) => void, options: AddEventListenerOptions = {}) {
    target.addEventListener(type, listener as EventListener, { ...options, signal: lifecycle.signal });
  }
  const { stations, lines, meta, visitedStations, coordinates, city, stationNotes, basemap, operatorsByStation, lineNames, neighbors, transportTransfers = {} } = data;
  // A same-origin or separately deployed proxy can be selected at build time.
  // The proxy keeps the upstream host out of browser requests while preserving
  // the TileJSON-relative `/tiles/osm/...` paths expected by VersaTiles style.
  const configuredProxyBase = typeof import.meta.env.PUBLIC_TILE_PROXY_BASE === 'string'
    ? import.meta.env.PUBLIC_TILE_PROXY_BASE.trim().replace(/\/+$/, '')
    : '';
  const tileBase = configuredProxyBase || basemap.base;
  const tileJsonUrl = configuredProxyBase ? `${configuredProxyBase}/tiles/osm/tiles.json` : basemap.tileset;
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
  const labelNodes = [...svg.querySelectorAll<SVGGElement>('[data-label]')];
  const stationById = new Map(stations.map(s => [String(s.id), s]));
  const lineById = new Map(lines.map(l => [String(l.id), l]));
  const geographicBounds = city.geographicBounds;
  const visited = new Set(visitedStations);
  const geographicContainer = document.querySelector<HTMLElement>('#geographic-map')!;
  geographicContainer.setAttribute('aria-label', `${city.name}地铁地图；矢量线网整体等比叠加到底图`);
  const mapStatus = document.querySelector<HTMLElement>('#map-status')!;
  let geographicMap = existingMap;
  let geographicLoad: Promise<void> | undefined;
  let geographicTileFailed = false;
  const geographicMarkers = new Map<string, SVGGElement>();
  let geographicOverlay: SVGSVGElement | undefined;
  const registration = registerDiagram(stations, coordinates, meta.width);
  const geographicCoordinates: Record<string, Coordinate> = registration.stationCoordinates;
  const homeNetworkBounds = networkBounds(Object.values(geographicCoordinates));
  const neighborOverlays = new Map<string, SVGSVGElement>();
  const neighborLinks = new Map([...document.querySelectorAll<HTMLAnchorElement>('[data-neighbor-city]')].map(link => [link.dataset.neighborCity!, link]));
  const cityPageCache = new Map<string, Promise<Document>>();
  let navigation: AbortController | undefined;
  let citySwitching = false;
  let exploringNeighbors = false;
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
  function requestCityPage(href: string, signal?: AbortSignal): Promise<Document> {
    const cached = cityPageCache.get(href);
    if (cached) return cached;
    const request = fetch(href, signal ? { signal } : undefined).then(async response => {
      if (!response.ok) throw new Error(`City page returned ${response.status}`);
      return new DOMParser().parseFromString(await response.text(), 'text/html');
    });
    cityPageCache.set(href, request);
    request.catch(() => { if (cityPageCache.get(href) === request) cityPageCache.delete(href); });
    return request;
  }
  function preloadCityPage(href: string) {
    if (href !== `${city.assetBase}/`) void requestCityPage(href).catch(() => undefined);
  }

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
    geographicOverlay?.querySelectorAll<SVGGElement>('[data-label]').forEach(label => {
      label.classList.toggle('dimmed', !!activeLine && !stationById.get(label.dataset.label!)?.lines.includes(activeLine));
    });
  }
  function positionGeographicOverlay() {
    if (!geographicMap || !geographicOverlay) return;
    const origin = geographicMap.project([registration.origin.lon, registration.origin.lat]);
    const east = geographicMap.project([registration.east.lon, registration.east.lat]);
    const scale = (east.x - origin.x) / meta.width;
    geographicOverlay.style.transform = `translate(${origin.x}px, ${origin.y}px) scale(${scale})`;
    for (const neighbor of neighbors) {
      const overlay = neighborOverlays.get(neighbor.id);
      if (!overlay) continue;
      const origin = geographicMap.project([neighbor.registration.origin.lon, neighbor.registration.origin.lat]);
      const east = geographicMap.project([neighbor.registration.east.lon, neighbor.registration.east.lat]);
      overlay.style.transform = `translate(${origin.x}px, ${origin.y}px) scale(${(east.x - origin.x) / neighbor.meta.width})`;
    }
    updateNeighborControls();
  }
  function boundsCenter(bounds: [[number, number], [number, number]]): [number, number] {
    return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
  }
  function updateNeighborControls() {
    const enabled = geographicMode() && !!geographicMap && exploringNeighbors && !citySwitching;
    const viewport = { width: workspace.clientWidth, height: workspace.clientHeight };
    const home = enabled ? geographicMap!.project(boundsCenter(homeNetworkBounds)) : undefined;
    const northwest = enabled ? geographicMap!.project([geographicBounds[0][0], geographicBounds[1][1]]) : undefined;
    const southeast = enabled ? geographicMap!.project([geographicBounds[1][0], geographicBounds[0][1]]) : undefined;
    const boundary = northwest && southeast ? { left: northwest.x, top: northwest.y, right: southeast.x, bottom: southeast.y } : undefined;
    for (const neighbor of neighbors) {
      const link = neighborLinks.get(neighbor.id)!;
      const placement = enabled ? neighborEdge(viewport,
        geographicMap!.project(boundsCenter(neighbor.networkBounds)), home!,
        Object.values(neighbor.registration.stationCoordinates).map(point => geographicMap!.project([point.lon, point.lat])),
        link.classList.contains('is-visible'), boundary) : undefined;
      link.classList.toggle('is-visible', !!placement);
      link.tabIndex = placement ? 0 : -1;
      link.setAttribute('aria-hidden', String(!placement));
      if (placement) {
        link.dataset.edge = placement.edge;
        let position = placement.position;
      const tools = document.querySelector<HTMLElement>('.map-tools')!.getBoundingClientRect();
      const zoom = document.querySelector<HTMLElement>('.zoom-controls')!.getBoundingClientRect();
        const frame = workspace.getBoundingClientRect();
        // Leave room for search and view controls on narrow screens.
        if (placement.edge === 'top') {
          const half = link.offsetWidth / 2;
          const minimum = tools.right - frame.left + half + 12;
          const maximum = viewport.width - half - 12;
          if (minimum <= maximum) position = Math.min(maximum, Math.max(minimum, position / 100 * viewport.width)) / viewport.width * 100;
      } else if (placement.edge === 'left') {
        const half = link.offsetHeight / 2;
        position = Math.min(viewport.height - half - 12, Math.max(tools.bottom - frame.top + half + 12, position / 100 * viewport.height)) / viewport.height * 100;
      } else if (placement.edge === 'bottom') {
        const half = link.offsetWidth / 2;
        const minimum = half + 12, maximum = zoom.left - frame.left - half - 12;
        if (minimum <= maximum) position = Math.min(maximum, Math.max(minimum, position / 100 * viewport.width)) / viewport.width * 100;
      } else if (placement.edge === 'right') {
        const half = link.offsetHeight / 2;
        const minimum = half + 12, maximum = zoom.top - frame.top - half - 12;
        if (minimum <= maximum) position = Math.min(maximum, Math.max(minimum, position / 100 * viewport.height)) / viewport.height * 100;
        }
        link.style.setProperty('--edge-position', `${position}%`);
      } else if (document.activeElement === link) geographicMap?.getCanvas().focus({ preventScroll: true });
    }
  }
  function mapHandlers(map: MapLibreMap) {
    return [map.dragPan, map.scrollZoom, map.boxZoom, map.doubleClickZoom, map.keyboard, map.touchZoomRotate];
  }
  async function destinationCamera(map: MapLibreMap, target: MetroPayload): Promise<CameraOptions> {
    const { LngLat, LngLatBounds } = await import('maplibre-gl');
    const registered = registerDiagram(target.stations, target.coordinates, target.meta.width);
    const camera = map.cameraForBounds(networkBounds(Object.values(registered.stationCoordinates)), { padding: 40, maxZoom: Math.min(12, target.basemap.maxZoom) });
    // Constrain a clone, so calculating the destination never moves the live map.
    const transform = map.transform.clone();
    transform.setMinZoom(0);
    transform.setMaxZoom(target.basemap.maxZoom);
    transform.setMaxBounds(new LngLatBounds(target.city.geographicBounds));
    const constrained = transform.applyConstrain(LngLat.convert(camera?.center ?? target.city.center), camera?.zoom ?? 11);
    const final = transform.applyConstrain(constrained.center, constrained.zoom);
    return { center: final.center.toArray(), zoom: final.zoom, bearing: 0, pitch: 0 };
  }
  async function destinationCameraForNeighbor(map: MapLibreMap, target: NeighborCity): Promise<CameraOptions> {
    const { LngLat, LngLatBounds } = await import('maplibre-gl');
    const camera = map.cameraForBounds(target.networkBounds, { padding: 40, maxZoom: Math.min(12, target.maxZoom) });
    const transform = map.transform.clone();
    transform.setMinZoom(0);
    transform.setMaxZoom(target.maxZoom);
    transform.setMaxBounds(new LngLatBounds(target.geographicBounds));
    const fallbackCenter = [(target.networkBounds[0][0] + target.networkBounds[1][0]) / 2, (target.networkBounds[0][1] + target.networkBounds[1][1]) / 2] as [number, number];
    const constrained = transform.applyConstrain(LngLat.convert(camera?.center ?? fallbackCenter), camera?.zoom ?? 11);
    const final = transform.applyConstrain(constrained.center, constrained.zoom);
    return { center: final.center.toArray(), zoom: final.zoom, bearing: 0, pitch: 0 };
  }
  function flyToCity(map: MapLibreMap, camera: CameraOptions, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      const finish = () => { map.off('moveend', finish); signal.removeEventListener('abort', cancel); resolve(); };
      const cancel = () => { map.off('moveend', finish); reject(signal.reason); };
      if (signal.aborted) { cancel(); return; }
      signal.addEventListener('abort', cancel, { once: true });
      map.once('moveend', finish);
      map.flyTo({ ...camera, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000 });
      if (!map.isMoving()) finish();
    });
  }
  async function navigateCity(href: string, push = true) {
    if (href === `${city.assetBase}/` && !citySwitching) return;
    if (citySwitching && push) return;
    navigation?.abort();
    geographicMap?.stop();
    const operation = new AbortController();
    navigation = operation;
    const timeout = window.setTimeout(() => operation.abort(new DOMException('City request timed out', 'TimeoutError')), 15000);
    citySwitching = true;
    workspace.classList.add('city-switching');
    workspace.querySelectorAll<HTMLElement>('.map-tools, .zoom-controls').forEach(control => control.inert = true);
    updateNeighborControls();
    closeCard();
    results.hidden = true;
    const map = geographicMap;
    const previous = map ? { center: map.getCenter().toArray(), zoom: map.getZoom(), minZoom: map.getMinZoom() } : undefined;
    if (map) for (const handler of mapHandlers(map)) handler.disable();
    try {
      // Start the page request and the cross-city flight together. Neighbor
      // metadata already contains the target bounds, so the animation does not
      // need to wait for the HTML response before moving.
      const targetNeighbor = neighbors.find(neighbor => neighbor.href === href);
      let camera = map && targetNeighbor ? await destinationCameraForNeighbor(map, targetNeighbor) : undefined;
      let flight: Promise<void> | undefined;
      if (map && camera) {
        map.setMaxBounds(null);
        map.setMinZoom(0);
        map.setMaxZoom(Math.max(basemap.maxZoom, targetNeighbor?.maxZoom ?? basemap.maxZoom));
        flight = flyToCity(map, camera, operation.signal);
      }
      const page = await requestCityPage(href, operation.signal);
      const next = readCityPayload(page);
      if (`${next.city.assetBase}/` !== href || !page.querySelector('.map-workspace')) throw new Error('Invalid city page');
      if (map && !camera) camera = await destinationCamera(map, next);
      if (operation.signal.aborted) throw operation.signal.reason;
      if (map && camera && !flight) {
        // Only the locked switching animation may cross the city boundary.
        map.setMaxBounds(null);
        map.setMinZoom(0);
        map.setMaxZoom(Math.max(basemap.maxZoom, next.basemap.maxZoom));
        flight = flyToCity(map, camera, operation.signal);
      }
      if (flight) await flight;
      if (operation.signal.aborted) throw operation.signal.reason;
      installCity(page, next, map, camera, href, push);
    } catch (error) {
      if (lifecycle.signal.aborted || navigation !== operation) return;
      if (!operation.signal.aborted || operation.signal.reason?.name === 'TimeoutError') {
        mapStatus.textContent = '城市加载失败，请重试';
        mapStatus.hidden = false;
      }
      if (map && previous) {
        map.setMaxBounds(geographicBounds);
        map.setMaxZoom(basemap.maxZoom);
        map.setMinZoom(previous.minZoom);
        map.jumpTo(previous);
      }
      if (!push) history.replaceState(null, '', `${city.assetBase}/`);
    } finally {
      clearTimeout(timeout);
      if (!lifecycle.signal.aborted && navigation === operation) {
        citySwitching = false;
        workspace.classList.remove('city-switching');
        workspace.querySelectorAll<HTMLElement>('.map-tools, .zoom-controls').forEach(control => control.inert = false);
        if (map) {
          for (const handler of mapHandlers(map)) handler.enable();
          map.touchZoomRotate.disableRotation();
          map.keyboard.disableRotation();
        }
        updateNeighborControls();
      }
    }
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
      listen(element, 'click', () => {
        if (!geographicMap!.isMoving() && element.getAttribute('aria-disabled') === 'false') selectStation(id);
      });
      listen(element, 'keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && element.getAttribute('aria-disabled') === 'false') {
          event.preventDefault(); selectStation(id);
        }
      });
      geographicMarkers.set(id, element);
    });
    // Interaction gating belongs to the map's zoom, not the copied vector view.
    overlay.classList.remove('stations-disabled');
    for (const neighbor of neighbors) {
      const template = document.querySelector<HTMLTemplateElement>(`template[data-neighbor-diagram="${neighbor.id}"]`)!;
      const preview = template.content.querySelector('svg')!.cloneNode(true) as SVGSVGElement;
      preview.style.width = `${neighbor.meta.width}px`;
      preview.style.height = `${neighbor.meta.height}px`;
      geographicMap!.getCanvasContainer().append(preview);
      neighborOverlays.set(neighbor.id, preview);
    }
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
  function resetGeographicMap(arrival?: CameraOptions) {
    if (!geographicMap) return;
    exploringNeighbors = false;
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
        if (!arrival) geographicMap.jumpTo(camera);
      }
    } else geographicMap.jumpTo({ center: city.center, zoom: 11 });
    geographicMap.setMinZoom(arrival?.zoom ?? geographicMap.getZoom());
    if (arrival) geographicMap.jumpTo(arrival);
    updateNeighborControls();
    renderGeographicControls();
  }
  function updateGeographicExtent() {
    if (!geographicMap) return;
    const atOverview = geographicMap.getZoom() <= geographicMap.getMinZoom() + .4;
    const current = geographicMap.getCenter();
    const zoom = geographicMap.getZoom();
    const exploring = exploringNeighbors;
    resetGeographicMap();
    exploringNeighbors = exploring;
    if (!atOverview) geographicMap.jumpTo({ center: current, zoom });
    else updateNeighborControls();
  }
  function attachMapEvents(map: MapLibreMap) {
    subscriptions.push(map.on('error', event => {
      if (!geographicTileFailed) console.error('真实地图资源加载失败', event.error);
      geographicTileFailed = true;
      mapStatus.textContent = '底图加载失败，请检查网络连接';
      mapStatus.hidden = !geographicMode();
    }));
    subscriptions.push(map.on('zoom', renderGeographicControls));
    subscriptions.push(map.on('movestart', event => {
      if (event.originalEvent) exploringNeighbors = true;
    }));
    subscriptions.push(map.on('move', positionGeographicOverlay));
    subscriptions.push(map.on('resize', updateGeographicExtent));
    subscriptions.push(map.on('load', () => { mapStatus.hidden = !geographicTileFailed; }));
  }
  async function loadGeographicMap() {
    if (geographicMap) {
      if (!geographicOverlay) {
        geographicMap.setMinZoom(0);
        geographicMap.setMaxZoom(basemap.maxZoom);
        geographicMap.setMaxBounds(geographicBounds);
        attachMapEvents(geographicMap);
        createGeographicOverlay();
        resetGeographicMap(initialCamera);
        for (const handler of mapHandlers(geographicMap)) handler.enable();
        geographicMap.touchZoomRotate.disableRotation();
        geographicMap.keyboard.disableRotation();
      }
      geographicMap.resize();
      mapStatus.hidden = !geographicTileFailed;
      renderGeographicControls();
      updateNeighborControls();
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
          urls: { base: tileBase, osm: tileJsonUrl },
        }));
        for (const layer of style.layers) {
          if (layer.type === 'line' && layer.id.includes('street-')) {
            const major = /motorway|trunk|primary/.test(layer.id);
            layer.minzoom = Math.max(layer.minzoom ?? 0, major ? 10 : 12);
            layer.paint = { ...layer.paint, 'line-opacity': .55 };
          }
        }
        if (lifecycle.signal.aborted || !geographicMode()) return;
        geographicMap = new maplibregl.Map({
          container: geographicContainer,
          style: style as unknown as StyleSpecification,
          center: initialCamera?.center ?? city.center,
          zoom: initialCamera?.zoom ?? 11,
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
        attachMapEvents(geographicMap);
        createGeographicOverlay();
        resetGeographicMap(initialCamera);
        const selectedPoint = selected ? coordinateFor(selected) : undefined;
        if (selectedPoint) geographicMap.jumpTo({ center: [selectedPoint.lon, selectedPoint.lat], zoom: basemap.maxZoom });
        renderGeographicControls();
      })().catch(error => {
        if (lifecycle.signal.aborted) return;
        console.error('真实地图初始化失败', error);
        try { geographicMap?.remove(); }
        catch { /* Keep the original initialization error and restore retry state. */ }
        geographicMap = undefined;
        geographicMarkers.clear();
        geographicOverlay = undefined;
        neighborOverlays.clear();
        updateNeighborControls();
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
    const transferSection = document.querySelector<HTMLElement>('#station-transfers')!;
    const destinations = [...new Set((transportTransfers[id] ?? []).map(transfer =>
      transfer.mode === 'gdIntercity' ? `${transfer.destination}（城际站）` : transfer.destination))];
    transferSection.hidden = !destinations.length;
    transferSection.textContent = destinations.length ? `可换乘：${destinations.join('、')}` : '';
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

  listen(svg, 'wheel', event => {
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
  listen(svg, 'pointerdown', event => {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) dragMoved = false;
    beginGesture();
    svg.setPointerCapture(event.pointerId);
    svg.classList.add('dragging');
  });
  listen(svg, 'pointermove', event => {
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
  listen(svg, 'pointerup', endPointer);
  listen(svg, 'pointercancel', endPointer);
  nodes.forEach(node => {
    listen(node, 'focus', () => {
      const station = stationById.get(node.dataset.station!);
      if (station && (station.x < view.x || station.x > view.x + view.width || station.y < view.y || station.y > view.y + view.height)) {
        view.x = station.x - view.width / 2;
        view.y = station.y - view.height / 2;
        render();
      }
    });
    listen(node, 'click', event => {
      if (stationsInteractive && !node.classList.contains('excluded') && event.detail === 0 && performance.now() > suppressClickUntil) selectStation(node.dataset.station!);
    });
    listen(node, 'keydown', event => {
      if (stationsInteractive && !node.classList.contains('excluded') && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectStation(node.dataset.station!); }
    });
    listen(node, 'pointerenter', () => {
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
    listen(node, 'pointerleave', () => tooltip.hidden = true);
  });
  listen(search, 'input', () => {
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
      listen(button, 'click', () => { search.value = station.name; selectStation(String(station.id), true); });
      results.append(button);
    });
    if (!matches.length) { const empty = document.createElement('div'); empty.className = 'search-empty'; empty.textContent = '没有找到这个站点'; results.append(empty); }
    results.hidden = false;
  });
  listen(search, 'keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector<HTMLButtonElement>('button')?.focus(); }
    if (event.key === 'Enter') results.querySelector<HTMLButtonElement>('button')?.click();
  });
  listen(results, 'keydown', event => {
    const buttons = [...results.querySelectorAll<HTMLButtonElement>('button')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); buttons[(index + 1) % buttons.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); if (index <= 0) search.focus(); else buttons[index - 1]?.focus(); }
  });
  document.querySelectorAll<HTMLButtonElement>('[data-line]').forEach(button => listen(button, 'click', () => filterLine(activeLine === button.dataset.line ? null : button.dataset.line!)));
  listen(document.querySelector('#all-lines')!, 'click', () => filterLine(null));
  document.querySelectorAll<HTMLButtonElement>('[data-map-view]').forEach(button => listen(button, 'click', () => {
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
    updateNeighborControls();
  }));

  for (const neighbor of neighbors) listen(neighborLinks.get(neighbor.id)!, 'click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !geographicMode() || !geographicMap) return;
    event.preventDefault();
    void navigateCity(neighbor.href);
  });
  document.querySelectorAll<HTMLAnchorElement>('.city-choice, [data-neighbor-city]').forEach(link => {
    const href = new URL(link.href, location.href).pathname;
    listen(link, 'pointerenter', () => preloadCityPage(href));
    listen(link, 'focus', () => preloadCityPage(href));
  });

  listen(document.querySelector('#close-card')!, 'click', closeCard);
  listen(document.querySelector('#zoom-in')!, 'click', () => geographicMode() ? geographicMap?.zoomIn() : zoom(1.5));
  listen(document.querySelector('#zoom-out')!, 'click', () => geographicMode() ? geographicMap?.zoomOut() : zoom(1 / 1.5));
  listen(document.querySelector('#reset-map')!, 'click', () => geographicMode() ? resetGeographicMap() : fit());

  listen(document, 'pointerdown', event => { if (!(event.target as Element).closest('.search-panel')) results.hidden = true; });
  listen(document, 'keydown', event => {
    if (citySwitching) return;
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
  const resizeObserver = new ResizeObserver(() => {
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
  });
  resizeObserver.observe(svg);
  updateVisitState();
  fit();
  if (geographicMode()) void loadGeographicMap();

  return {
    navigate: navigateCity,
    dispose(keepMap?: MapLibreMap) {
      lifecycle.abort();
      navigation?.abort();
      subscriptions.forEach(subscription => subscription.unsubscribe());
      resizeObserver.disconnect();
      geographicOverlay?.remove();
      neighborOverlays.forEach(overlay => overlay.remove());
      if (geographicMap && geographicMap !== keepMap) geographicMap.remove();
    },
  };
}

function readCityPayload(page: Document): MetroPayload {
  const source = page.querySelector('#metro-city-data')?.textContent;
  if (!source) throw new Error('Missing city data');
  const data = JSON.parse(source) as MetroPayload;
  if (!data.city || !Array.isArray(data.stations) || !Array.isArray(data.lines)
    || !['shenzhen', 'dongguan', 'nanning'].includes(data.city.id)) throw new Error('Invalid city data');
  return data;
}
function installCity(page: Document, data: MetroPayload, map: MapLibreMap | undefined, camera: CameraOptions | undefined, href: string, push: boolean) {
  const workspace = document.importNode(page.querySelector('.map-workspace')!, true);
  workspace.querySelectorAll('script').forEach(script => script.remove());
  activeCity.dispose(map);
  if (map) {
    map.getContainer().hidden = false;
    workspace.querySelector('#geographic-map')!.replaceWith(map.getContainer());
  }
  document.querySelector('main')!.replaceChildren(workspace);
  document.querySelector('.brand-city')!.textContent = data.city.name;
  document.querySelector('.visit-summary')!.replaceChildren(...[...page.querySelector('.visit-summary')!.childNodes].map(node => document.importNode(node, true)));
  document.querySelector('#city-menu nav')!.replaceChildren(...[...page.querySelector('#city-menu nav')!.childNodes].map(node => document.importNode(node, true)));
  document.title = page.title;
  document.querySelector('meta[name="description"]')!.setAttribute('content', page.querySelector('meta[name="description"]')!.getAttribute('content')!);
  window.__metroData = data;
  if (push && location.pathname !== href) history.pushState(null, '', href);
  activeCity = mountCity(data, map, camera);
}

window.__metroData = readCityPayload(document);
let activeCity = mountCity(window.__metroData);
document.addEventListener('click', event => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('.city-choice');
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  document.querySelector<HTMLDialogElement>('#city-menu')!.close();
  void activeCity.navigate(new URL(link.href).pathname);
});
window.addEventListener('popstate', () => {
  if (['/', '/dongguan/', '/nanning/'].includes(location.pathname)) void activeCity.navigate(location.pathname, false);
});
