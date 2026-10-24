import type { GeoJsonObject } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { cameraView, mapZoom } from "@/lib/config/display";

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function boundsOf(geometry: GeoJsonObject): [[number, number], [number, number]] {
  const box = { west: 180, east: -180, south: 90, north: -90 };
  const visit = (value: unknown) => {
    if (!Array.isArray(value) || value.length === 0) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      box.west = Math.min(box.west, value[0]);
      box.east = Math.max(box.east, value[0]);
      box.south = Math.min(box.south, value[1]);
      box.north = Math.max(box.north, value[1]);
      return;
    }
    for (const item of value) visit(item);
  };
  const walk = (value: GeoJsonObject) => {
    if (value.type === "Feature") {
      if (value.geometry) walk(value.geometry);
      return;
    }
    if (value.type === "FeatureCollection") {
      for (const feature of value.features) walk(feature);
      return;
    }
    if ("coordinates" in value) visit(value.coordinates);
  };
  walk(geometry);
  return [
    [box.west, box.south],
    [box.east, box.north],
  ];
}

export function pitched(reduced = prefersReducedMotion()) {
  return reduced ? { pitch: 0, bearing: 0 } : { pitch: cameraView.pitch, bearing: cameraView.bearing };
}

export function installNavigationLimits(map: MapLibreMap, movement: GeoJsonObject, reporting: GeoJsonObject) {
  const limit = boundsOf(movement);
  const campus = boundsOf(reporting);
  const apply = () => {
    map.resize();
    const pose = pitched();
    map.setMaxPitch(pose.pitch === 0 ? 0 : 60);
    map.setMaxBounds(limit);
    const fitted = map.cameraForBounds(limit, { padding: 24, bearing: pose.bearing, pitch: pose.pitch });
    if (fitted?.zoom != null) {
      map.setMinZoom(fitted.zoom);
      if (map.getZoom() < fitted.zoom) map.jumpTo({ zoom: fitted.zoom });
    }
    map.setMaxZoom(mapZoom.max);
  };
  apply();
  const pose = pitched();
  map.fitBounds(campus, {
    padding: { top: 88, bottom: 96, left: 80, right: 80 },
    duration: 0,
    bearing: pose.bearing,
    pitch: pose.pitch,
  });
  const onResize = () => apply();
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMotion = () => {
    const next = pitched();
    map.setMaxPitch(next.pitch === 0 ? 0 : 60);
    map.easeTo({ pitch: next.pitch, bearing: next.bearing, duration: 0 });
  };
  window.addEventListener("resize", onResize);
  media.addEventListener("change", onMotion);
  return () => {
    window.removeEventListener("resize", onResize);
    media.removeEventListener("change", onMotion);
  };
}

export function runViewCommand(
  map: MapLibreMap,
  command: { kind: "fit" | "fly" | "zoom-in" | "zoom-out"; latitude?: number; longitude?: number; zoom?: number },
  reporting: GeoJsonObject,
) {
  const pose = pitched();
  const duration = prefersReducedMotion() ? 0 : 650;
  if (command.kind === "fit") {
    map.fitBounds(boundsOf(reporting), {
      padding: { top: 88, bottom: 96, left: 80, right: 80 },
      duration,
      bearing: pose.bearing,
      pitch: pose.pitch,
    });
    return;
  }
  if (command.kind === "zoom-in" || command.kind === "zoom-out") {
    const next = map.getZoom() + (command.kind === "zoom-in" ? 0.5 : -0.5);
    map.easeTo({
      zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), next)),
      duration: prefersReducedMotion() ? 0 : 280,
      bearing: pose.bearing,
      pitch: pose.pitch,
    });
    return;
  }
  if (command.latitude === undefined || command.longitude === undefined) return;
  const bounds = map.getMaxBounds();
  let latitude = command.latitude;
  let longitude = command.longitude;
  if (bounds) {
    latitude = Math.min(bounds.getNorth(), Math.max(bounds.getSouth(), latitude));
    longitude = Math.min(bounds.getEast(), Math.max(bounds.getWest(), longitude));
  }
  map.easeTo({
    center: [longitude, latitude],
    zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), command.zoom ?? 17.5)),
    duration,
    bearing: pose.bearing,
    pitch: pose.pitch,
  });
}
