import boundaries from "@/data/geo/boundaries.json";
import buildings from "@/data/geo/buildings.json";
import facilities from "@/data/geo/facilities.json";
import paths from "@/data/geo/paths.json";
import streets from "@/data/geo/streets.json";
import streetLines from "@/data/geo/street-lines.json";
import { landmarks, seededLibraryPin } from "@/data/geo/landmarks";
import { regionNames } from "@/lib/config/display";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { booleanPointInPolygon, centroid, distance, point, polygon } from "@turf/turf";

export { landmarks, seededLibraryPin };

type Props = {
  id?: string;
  name?: string | null;
  landmarkId?: string;
  kind?: string;
  edge?: string;
  ring?: string;
  band?: string;
  amenity?: string | null;
  entrance?: string | null;
};

export const boundaryCollection = boundaries as unknown as FeatureCollection<Polygon, Props>;
export const buildingCollection = buildings as unknown as FeatureCollection<Polygon, Props>;
export const pathCollection = paths as unknown as FeatureCollection;
export const facilityCollection = facilities as unknown as FeatureCollection;
export const streetLabelCollection = streets as unknown as FeatureCollection;
export const streetLineCollection = streetLines as unknown as FeatureCollection;

export const namedBuildings = buildingCollection.features.flatMap((feature) => {
  const name = feature.properties?.name;
  if (!name || feature.properties?.landmarkId) return [];
  const [longitude, latitude] = centroid(feature).geometry.coordinates;
  return [{ id: String(feature.id ?? name), name, longitude, latitude, band: feature.properties?.band ?? "campus" }];
});

export const reportingBoundary = boundaryCollection.features.find((feature) => feature.properties?.id === "reporting-boundary");
export const movementBoundary = boundaryCollection.features.find((feature) => feature.properties?.id === "movement-boundary");
export const regionBoundaries = boundaryCollection.features.filter((feature) => feature.properties?.kind === "region");

if (!reportingBoundary || !movementBoundary) {
  throw new Error("Campus boundary files are incomplete");
}

export function movementMask(): Feature<Polygon> {
  const ring = movementBoundary!.geometry.coordinates[0];
  const longitudes = ring.map((coordinate) => coordinate[0]);
  const latitudes = ring.map((coordinate) => coordinate[1]);
  const pad = 0.03;
  const west = Math.min(...longitudes) - pad;
  const east = Math.max(...longitudes) + pad;
  const south = Math.min(...latitudes) - pad;
  const north = Math.max(...latitudes) + pad;
  const outer = polygon([
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ]);
  const hole = [...ring].reverse();
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [outer.geometry.coordinates[0], hole] },
  };
}

export function isInsideReporting(latitude: number, longitude: number) {
  return booleanPointInPolygon(point([longitude, latitude]), reportingBoundary!);
}

export function isInsideMovement(latitude: number, longitude: number) {
  return booleanPointInPolygon(point([longitude, latitude]), movementBoundary!);
}

export function regionIdFor(latitude: number, longitude: number) {
  const here = point([longitude, latitude]);
  for (const region of regionBoundaries) {
    if (booleanPointInPolygon(here, region)) return region.properties?.id ?? "main-campus";
  }
  return "main-campus";
}

export function regionNameFor(regionId: string) {
  return regionNames[regionId] ?? "Main Campus";
}

export function nearestLandmark(latitude: number, longitude: number, maxMeters = 120) {
  const here = point([longitude, latitude]);
  let best: (typeof landmarks)[number] | null = null;
  let bestDistance = maxMeters;
  for (const landmark of landmarks) {
    const meters = distance(here, point([landmark.longitude, landmark.latitude]), { units: "meters" });
    if (meters < bestDistance) {
      best = landmark;
      bestDistance = meters;
    }
  }
  return best;
}

export function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  return distance(point([aLng, aLat]), point([bLng, bLat]), { units: "meters" });
}
