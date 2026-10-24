import type { LatLngBounds, Map as LeafletMap } from "leaflet";
import L from "leaflet";
import type { GeoJsonObject } from "geojson";

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function flyClamped(map: LeafletMap, latitude: number, longitude: number, zoom: number) {
  const bounds = map.options.maxBounds as LatLngBounds | undefined;
  const nextZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom));
  let lat = latitude;
  let lng = longitude;
  if (bounds) {
    lat = Math.min(bounds.getNorth(), Math.max(bounds.getSouth(), lat));
    lng = Math.min(bounds.getEast(), Math.max(bounds.getWest(), lng));
  }
  const duration = prefersReducedMotion() ? 0 : 0.65;
  map.flyTo([lat, lng], nextZoom, { duration, animate: duration > 0 });
}

export function installNavigationLimits(map: LeafletMap, movement: GeoJsonObject, reporting: GeoJsonObject) {
  const limit = L.geoJSON(movement).getBounds();
  const campusBounds = L.geoJSON(reporting).getBounds();
  const apply = () => {
    map.invalidateSize();
    const min = map.getBoundsZoom(limit, false, L.point(20, 64));
    map.setMinZoom(min);
    map.setMaxBounds(limit);
    map.options.bounceAtZoomLimits = false;
    if (map.getZoom() < min) map.setZoom(min);
    map.panInsideBounds(limit, { animate: false });
  };
  apply();
  map.fitBounds(campusBounds, { padding: [28, 64], animate: false });
  window.addEventListener("resize", apply);
  return () => window.removeEventListener("resize", apply);
}

export function runViewCommand(
  map: LeafletMap,
  command: { kind: "fit" | "fly" | "zoom-in" | "zoom-out"; latitude?: number; longitude?: number; zoom?: number },
  reporting: GeoJsonObject,
) {
  const campusBounds = L.geoJSON(reporting).getBounds();
  if (command.kind === "fit") {
    const duration = prefersReducedMotion() ? 0 : 0.65;
    map.fitBounds(campusBounds, { padding: [28, 64], animate: duration > 0, duration });
    return;
  }
  if (command.kind === "zoom-in" || command.kind === "zoom-out") {
    const next = map.getZoom() + (command.kind === "zoom-in" ? 0.5 : -0.5);
    map.setZoom(Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), next)));
    return;
  }
  if (command.latitude !== undefined && command.longitude !== undefined) {
    flyClamped(map, command.latitude, command.longitude, command.zoom ?? 18);
  }
}
