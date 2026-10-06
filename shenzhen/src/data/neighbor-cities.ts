import { shenzhenDataset, type MetroCityDataset, type Coordinate } from './metro-city';
import { dongguanDataset } from './dongguan-city';
import { registerDiagram } from './map-registration.mjs';
import { networkBounds } from './neighbor-navigation.mjs';

export interface NeighborCity {
  id: string; name: string; href: string;
  meta: MetroCityDataset['mapMeta'];
  geographicBounds: MetroCityDataset['city']['geographicBounds'];
  networkBounds: [[number, number], [number, number]];
  registration: { origin: Coordinate; east: Coordinate; stationCoordinates: Record<string, Coordinate> };
  maxZoom: number;
}

// Only cities with a maintained metro dataset can be shown or switched to.
export function neighboringDatasets(id: string): MetroCityDataset[] {
  if (id === 'shenzhen') return [dongguanDataset];
  if (id === 'dongguan') return [shenzhenDataset];
  return [];
}

export function neighborCity(dataset: MetroCityDataset): NeighborCity {
  const registration = registerDiagram([...dataset.stations, ...dataset.plannedStations], dataset.coordinates, dataset.mapMeta.width);
  return {
    id: dataset.city.id, name: dataset.city.name, href: `${dataset.city.assetBase}/`,
    meta: dataset.mapMeta, geographicBounds: dataset.city.geographicBounds,
    networkBounds: networkBounds(Object.values(registration.stationCoordinates)),
    registration, maxZoom: dataset.basemap.maxZoom,
  };
}
