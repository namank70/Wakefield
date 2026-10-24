import type { Geometry } from "geojson";

export function metersBetween(latA: number, lngA: number, latB: number, lngB: number) {
  const earth = 6371000;
  const lat1 = (latA * Math.PI) / 180;
  const lat2 = (latB * Math.PI) / 180;
  const dLat = ((latB - latA) * Math.PI) / 180;
  const dLng = ((lngB - lngA) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

function visitCoordinates(node: unknown, visit: (longitude: number, latitude: number) => void) {
  if (!Array.isArray(node) || node.length === 0) return;
  if (typeof node[0] === "number" && typeof node[1] === "number") {
    visit(node[0], node[1]);
    return;
  }
  for (const child of node) visitCoordinates(child, visit);
}

export function metersToGeometry(latitude: number, longitude: number, geometry: Geometry) {
  if (geometry.type === "GeometryCollection") return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  visitCoordinates(geometry.coordinates, (featureLongitude, featureLatitude) => {
    best = Math.min(best, metersBetween(latitude, longitude, featureLatitude, featureLongitude));
  });
  return best;
}
