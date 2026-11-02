import { mapMeta, stations as sourceStations, plannedStations, lines } from '../../../hangzhou/data/stations';
import sourceSymbols from '../../../hangzhou/data/station-symbols.json';
import routes from '../../../hangzhou/data/route-paths.json';
import labels from '../../../hangzhou/data/station-labels.json';
import englishNames from '../../../hangzhou/data/station-english.json';
import sourceVisitedStations from '../../../hangzhou/data/visited-stations.json';
import coordinates from '../../../hangzhou/data/station-coordinates.json';
import sourceStationNotes from '../../../hangzhou/data/station-notes.json';
import basemap from '../../../hangzhou/data/basemap.json';
import sourceTransportTransfers from '../../../hangzhou/data/transport-transfers.json';
import diagramRegistration from '../../../hangzhou/data/diagram-registration.json';
import { registerDiagram } from './map-registration.mjs';
import { validateVisitedStations } from './validate-visited.mjs';
import { validateStationNotes } from './validate-station-notes.mjs';
import { shaoxingLine1, shaoxingLine1Operator, guniangqiaoShape } from './hangzhou-shaoxing-interchanges';
import type { MetroCityDataset, Coordinate, MetroOperator, StationLabel, StationSymbolGeometry, TransportTransfer } from './metro-city';

const eastId = '火车东站', eastSquareId = '火车东站(东广场)';
const east = sourceStations.find(station => station.id === eastId)!;
const eastSquare = sourceStations.find(station => station.id === eastSquareId)!;
const canonicalId = (id: string) => id === eastSquareId ? eastId : id;
validateVisitedStations(sourceVisitedStations, new Set(sourceStations.map(station => station.id)));
validateStationNotes(sourceStationNotes, new Set([...sourceStations, ...plannedStations].map(station => station.id)));
const stations = sourceStations.filter(station => station.id !== eastSquareId).map(station => station.id === eastId ? {
  ...station, x: (east.x + eastSquare.x) / 2, y: (east.y + eastSquare.y) / 2,
  lines: [...east.lines, ...eastSquare.lines],
  aliases: [...new Set([...(east.aliases ?? []), eastSquareId, '火车东站（东广场）', '东广场', englishNames[eastSquareId], ...(eastSquare.aliases ?? [])])],
} : station);
const visitedStations = [...new Set(sourceVisitedStations.map(canonicalId))];
const stationNotes: Record<string, string> = {};
for (const [id, note] of Object.entries(sourceStationNotes)) {
  const key = canonicalId(id);
  stationNotes[key] = [stationNotes[key], note].filter(Boolean).join('\n');
}
stationNotes[eastId] = ['1、4号线与6、19号线可通过换乘通道虚拟换乘。', stationNotes[eastId]].filter(Boolean).join('\n');
const transportTransfers: Record<string, TransportTransfer[]> = {};
for (const [id, transfers] of Object.entries(sourceTransportTransfers)) {
  const key = canonicalId(id), previous = transportTransfers[key] ?? [];
  transportTransfers[key] = [...previous, ...(transfers as TransportTransfer[]).filter(transfer => !previous.some(item => item.mode === transfer.mode))];
}
const symbols: Record<string, StationSymbolGeometry> = {
  ...sourceSymbols,
  [eastId]: {
    parts: [...sourceSymbols[eastId].parts, ...sourceSymbols[eastSquareId].parts],
    connections: [{ x1: east.x, y1: east.y, x2: eastSquare.x, y2: eastSquare.y, kind: 'out-of-station' }],
  },
  姑娘桥: { parts: [{ ...guniangqiaoShape, x: 3650, y: 2230, lines: ['5', shaoxingLine1.id] }] },
};

const registration = registerDiagram([...stations, ...plannedStations], coordinates, mapMeta.width, diagramRegistration);
const registered = Object.values(registration.stationCoordinates) as Coordinate[];
const geographicBounds: [[number, number], [number, number]] = [
  [Math.min(...registered.map(point => point.lon)) - .06, Math.min(...registered.map(point => point.lat)) - .05],
  [Math.max(...registered.map(point => point.lon)) + .06, Math.max(...registered.map(point => point.lat)) + .05],
];
const metroOperator = { id: 'hangzhou-metro', name: '杭州地铁', company: '杭州地铁运营有限公司', logo: '/operators/hangzhou-metro.png', url: 'https://www.hzmetro.com/' };
const hanghaiOperator = { id: 'hanghai-rail', name: '浙江轨道集团', company: '浙江海宁轨道交通运营管理有限公司', logo: '/operators/hanghai-rail.png', url: 'https://www.cncico.com/' };
function stationOperators(lineIds: string[]): MetroOperator[] {
  const operators: MetroOperator[] = [];
  if (lineIds.some(line => !['1', '5', 'hh'].includes(line))) operators.push(metroOperator);
  const companies = [lineIds.includes('1') ? '杭州杭港地铁有限公司' : '', lineIds.includes('5') ? '杭州杭港地铁五号线有限公司' : ''].filter(Boolean);
  if (companies.length) operators.push({ id: 'hanggang', name: '杭港地铁', company: companies.join('；'), logo: '/operators/hanggang-metro.png', url: 'https://www.mtrhz.com.cn/' });
  if (lineIds.includes('hh')) operators.push(hanghaiOperator);
  return operators;
}

export const hangzhouDataset: MetroCityDataset = {
  city: { id: 'hangzhou', name: '杭州', assetBase: '/hangzhou', center: [120.20, 30.27], geographicBounds },
  mapMeta, stations, plannedStations, lines,
  symbols: symbols as Record<string, StationSymbolGeometry>, routes,
  labels: labels as Record<string, StationLabel>, englishNames,
  visitedStations, coordinates, stationNotes, basemap, lineNames: {}, diagramRegistration,
  transportTransfers: transportTransfers as Record<string, TransportTransfer[]>,
  externalLinesByStation: { 姑娘桥: [shaoxingLine1] },
  operatorsByStation: Object.fromEntries(stations.map(station => [station.id, [...stationOperators(station.lines), ...(station.id === '姑娘桥' ? [shaoxingLine1Operator] : [])]])),
};
