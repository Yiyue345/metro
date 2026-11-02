import { shenzhenDataset, type MetroCityDataset, type Coordinate } from './metro-city';
import { dongguanDataset } from './dongguan-city';
import { hangzhouDataset } from './hangzhou-city';
import { shaoxingDataset } from './shaoxing-city';
import { hongkongContext } from './hongkong-context';
import { registerDiagram } from './map-registration.mjs';
import { networkBounds } from './neighbor-navigation.mjs';

export interface NeighborCity {
  id: string; name: string; href?: string;
  meta: MetroCityDataset['mapMeta'];
  geographicBounds: MetroCityDataset['city']['geographicBounds'];
  networkBounds: [[number, number], [number, number]];
  registration: { origin: Coordinate; east: Coordinate; stationCoordinates: Record<string, Coordinate> };
  maxZoom: number;
}

// Only maintained city pages supply navigable neighbors.
export function neighboringDatasets(id: string): MetroCityDataset[] {
  if (id === 'shenzhen') return [dongguanDataset];
  if (id === 'dongguan') return [shenzhenDataset];
  if (id === 'hangzhou') return [shaoxingDataset];
  if (id === 'shaoxing') return [hangzhouDataset];
  return [];
}

export function contextualDatasets(id: string): MetroCityDataset[] {
  return id === 'shenzhen' ? [hongkongContext] : [];
}

export function neighborCity(dataset: MetroCityDataset, navigable = true): NeighborCity {
  const registration = registerDiagram([...dataset.stations, ...dataset.plannedStations], dataset.coordinates, dataset.mapMeta.width, dataset.diagramRegistration);
  return {
    id: dataset.city.id, name: dataset.city.name, ...(navigable ? { href: `${dataset.city.assetBase}/` } : {}),
    meta: dataset.mapMeta, geographicBounds: dataset.city.geographicBounds,
    networkBounds: networkBounds(Object.values(registration.stationCoordinates)),
    registration, maxZoom: dataset.basemap.maxZoom,
  };
}
