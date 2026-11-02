import { mapMeta, stations, plannedStations, lines } from '../../../shaoxing/data/stations';
import symbols from '../../../shaoxing/data/station-symbols.json';
import routes from '../../../shaoxing/data/route-paths.json';
import labels from '../../../shaoxing/data/station-labels.json';
import englishNames from '../../../shaoxing/data/station-english.json';
import visitedStations from '../../../shaoxing/data/visited-stations.json';
import coordinates from '../../../shaoxing/data/station-coordinates.json';
import stationNotes from '../../../shaoxing/data/station-notes.json';
import basemap from '../../../shaoxing/data/basemap.json';
import transportTransfers from '../../../shaoxing/data/transport-transfers.json';
import diagramRegistration from '../../../shaoxing/data/diagram-registration.json';
import { registerDiagram } from './map-registration.mjs';
import { hangzhouLine5, hanggangLine5Operator, guniangqiaoShape } from './hangzhou-shaoxing-interchanges';
import type { MetroCityDataset, Coordinate, StationLabel, StationSymbolGeometry, TransportTransfer } from './metro-city';

const registration = registerDiagram([...stations, ...plannedStations], coordinates, mapMeta.width, diagramRegistration);
const registered = Object.values(registration.stationCoordinates) as Coordinate[];
const geographicBounds: [[number, number], [number, number]] = [
  [Math.min(...registered.map(point => point.lon)) - .05, Math.min(...registered.map(point => point.lat)) - .05],
  [Math.max(...registered.map(point => point.lon)) + .05, Math.max(...registered.map(point => point.lat)) + .05],
];
const line1Operator = { id: 'shaoxing-jingyue', name: '绍兴京越地铁', company: '绍兴京越地铁有限公司运营分公司', logo: '/operators/shaoxing-jingyue.png', url: 'https://www.jymetro.com.cn/' };
const line2Operator = { id: 'shaoxing-metro', name: '绍兴轨道交通', company: '绍兴市轨道交通集团有限公司运营分公司', logo: '/operators/shaoxing-metro.png', url: 'https://www.sxsmtr.com/' };

export const shaoxingDataset: MetroCityDataset = {
  city: { id: 'shaoxing', name: '绍兴', assetBase: '/shaoxing', center: [120.59, 30.04], geographicBounds },
  mapMeta, stations, plannedStations, lines,
  symbols: { ...symbols, 姑娘桥: { parts: [{ ...guniangqiaoShape, x: 170, y: 60, lines: [hangzhouLine5.id, '1'] }] } } as Record<string, StationSymbolGeometry>, routes,
  labels: labels as Record<string, StationLabel>, englishNames,
  visitedStations, coordinates, stationNotes, basemap, lineNames: {}, diagramRegistration,
  transportTransfers: transportTransfers as Record<string, TransportTransfer[]>,
  externalLinesByStation: { 姑娘桥: [hangzhouLine5] },
  operatorsByStation: Object.fromEntries(stations.map(station => [station.id, [
    ...(station.lines.includes('1') ? [line1Operator] : []),
    ...(station.lines.includes('2') ? [line2Operator] : []),
    ...(station.id === '姑娘桥' ? [hanggangLine5Operator] : []),
  ]])),
};
