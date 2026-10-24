import type { Feature, FeatureCollection } from "geojson";
import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { isUnresolved, levelForIssue, prototypeRevealResolver, type LocalReveal } from "@/lib/activation/reveal";
import { colors, extrusionMeters } from "@/lib/config/display";
import { landmarks } from "@/data/geo/landmarks";
import {
  buildingCollection,
  facilityCollection,
  movementBoundary,
  movementMask,
  pathCollection,
  regionBoundaries,
  reportingBoundary,
  streetLineCollection,
} from "@/lib/geo/campus";
import { metersToGeometry } from "@/lib/geo/distance";
import type { Issue, Report, RevealLevel } from "@/lib/types";

const library = landmarks.find((landmark) => landmark.id === "library")!;

const empty: FeatureCollection = { type: "FeatureCollection", features: [] };

export type SceneInput = {
  issues: Issue[];
  reports: Report[];
  previewLevel: RevealLevel | null;
};

type Frame = "quiet" | "stirring" | "active" | "urgent";

const shownHeights = new Map<string, number>();
let heightFrame = 0;
let pulseFrame = 0;

function featureKey(feature: Feature) {
  return String(feature.id ?? feature.properties?.id ?? "");
}

function nearLibrary(feature: Feature) {
  if (feature.properties && "landmarkId" in feature.properties && feature.properties.landmarkId === "library") return true;
  return metersToGeometry(library.latitude, library.longitude, feature.geometry) <= 55;
}

function frameFor(level: number, urgent: boolean): Frame {
  if (urgent) return "urgent";
  if (level >= 3) return "active";
  if (level >= 1) return "stirring";
  return "quiet";
}

function tone(reveal: LocalReveal) {
  if (reveal.urgent) return colors.urgent;
  if (reveal.level >= 3) return colors.cyan;
  if (reveal.level >= 1) return colors.violet;
  return "#B7C8DC";
}

function revealFor(feature: Feature, kind: "building" | "path" | "facility", input: SceneInput): LocalReveal {
  if (input.previewLevel !== null && nearLibrary(feature)) {
    return {
      level: input.previewLevel,
      score: 0,
      urgent: false,
      accessibilityFloor: false,
      summary: "Visual preview",
      category: null,
      severity: null,
      status: null,
      issueIds: [],
    };
  }
  const properties = feature.properties as { id?: string; landmarkId?: string } | null;
  return prototypeRevealResolver.resolve(
    {
      id: properties?.id ?? String(feature.id ?? ""),
      kind,
      geometry: feature.geometry,
      landmarkId: properties?.landmarkId,
    },
    input.issues,
    input.reports,
  );
}

function paintBuildings(input: SceneInput): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: buildingCollection.features.map((feature) => {
      const band = feature.properties?.band === "block" ? "block" : "campus";
      const reveal = revealFor(feature, "building", input);
      const frame = frameFor(reveal.level, reveal.urgent);
      const color = tone(reveal);
      const quietFill = band === "block" ? "#121A2C" : "#10182A";
      return {
        type: "Feature",
        id: feature.id,
        properties: {
          id: featureKey(feature),
          height: extrusionMeters[reveal.level],
          level: reveal.level,
          urgent: reveal.urgent ? 1 : 0,
          frame,
          color,
          fill: reveal.level === 0 ? quietFill : color,
          fillOpacity: reveal.level === 0 ? (band === "block" ? 0.55 : 0.4) : 0.22,
          band,
        },
        geometry: feature.geometry,
      };
    }),
  };
}

function paintPaths(input: SceneInput): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pathCollection.features.map((feature) => {
      const reveal = revealFor(feature, "path", input);
      return {
        type: "Feature",
        id: feature.id,
        properties: {
          color: reveal.level === 0 ? "#8EA3BD" : tone(reveal),
          width: reveal.level >= 3 ? 2.6 : 1.4,
          opacity: reveal.level === 0 ? 0.9 : 0.95,
        },
        geometry: feature.geometry,
      };
    }),
  };
}

function regionScore(regionId: string, input: SceneInput) {
  const open = input.issues.filter((issue) => isUnresolved(issue) && issue.regionId === regionId);
  return {
    level: open.reduce((highest, issue) => Math.max(highest, levelForIssue(issue, input.reports)), 0),
    urgent: open.some((issue) => issue.severity === "urgent"),
  };
}

function paintRegions(input: SceneInput): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: regionBoundaries.map((feature) => {
      const regionId = String(feature.properties?.id ?? "");
      const preview = input.previewLevel !== null && regionId === "library" ? input.previewLevel : 0;
      const scored = regionScore(regionId, input);
      const level = Math.max(preview, scored.level);
      const urgent = scored.urgent;
      return {
        type: "Feature" as const,
        id: feature.id,
        properties: {
          frame: frameFor(level, urgent),
          color: urgent ? colors.urgent : level >= 3 ? colors.cyan : level >= 1 ? colors.violet : "#8EA4BE",
        },
        geometry: feature.geometry,
      };
    }),
  };
}

function paintFacilities(input: SceneInput): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: facilityCollection.features.flatMap((feature) => {
      const reveal = revealFor(feature, "facility", input);
      if (reveal.level < 3) return [];
      const kind = feature.properties && "kind" in feature.properties ? String(feature.properties.kind) : "entrance";
      return [
        {
          type: "Feature" as const,
          id: feature.id,
          properties: { color: kind === "bicycle_parking" ? colors.violet : colors.amber },
          geometry: feature.geometry,
        },
      ];
    }),
  };
}

function source(map: MapLibreMap, id: string) {
  return map.getSource(id) as GeoJSONSource;
}

function outline(id: string, frame: Frame, width: number, opacity: number, dash?: number[]): {
  id: string;
  type: "line";
  source: string;
  filter: FilterSpecification;
  paint: {
    "line-color": ["get", "color"];
    "line-width": number;
    "line-opacity": number;
    "line-dasharray"?: number[];
  };
} {
  return {
    id,
    type: "line",
    source: id.startsWith("regions") ? "regions" : "buildings",
    filter: ["==", ["get", "frame"], frame],
    paint: {
      "line-color": ["get", "color"],
      "line-width": width,
      "line-opacity": opacity,
      ...(dash ? { "line-dasharray": dash } : {}),
    },
  };
}

export function ensureLayers(map: MapLibreMap) {
  if (map.getSource("buildings")) return;
  const add = (id: string, data: FeatureCollection | Feature) => {
    map.addSource(id, { type: "geojson", data });
  };
  add("streets", streetLineCollection);
  add("mask", movementMask());
  add("paths", empty);
  add("buildings", empty);
  add("regions", empty);
  add("facilities", empty);
  add("reporting", reportingBoundary!);
  add("movement", movementBoundary!);

  map.addLayer({
    id: "streets",
    type: "line",
    source: "streets",
    paint: {
      "line-color": ["case", ["==", ["get", "ring"], "outer"], "#D5E2F2", "#8EA3BD"],
      "line-width": ["case", ["==", ["get", "ring"], "outer"], 2.2, 1.2],
      "line-opacity": ["case", ["==", ["get", "ring"], "outer"], 0.95, 0.55],
    },
  });
  map.addLayer({
    id: "mask",
    type: "fill",
    source: "mask",
    paint: { "fill-color": colors.background, "fill-opacity": 1 },
  });
  map.addLayer({
    id: "paths",
    type: "line",
    source: "paths",
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["get", "width"],
      "line-opacity": ["get", "opacity"],
    },
  });
  map.addLayer({
    id: "buildings-fill",
    type: "fill",
    source: "buildings",
    paint: {
      "fill-color": ["get", "fill"],
      "fill-opacity": ["get", "fillOpacity"],
    },
  });
  map.addLayer({
    id: "buildings-extrude",
    type: "fill-extrusion",
    source: "buildings",
    filter: [">", ["get", "height"], 0],
    paint: {
      "fill-extrusion-color": ["get", "color"],
      "fill-extrusion-height": ["get", "height"],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.86,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  map.addLayer(outline("buildings-quiet", "quiet", 1.15, 0.7, [1.2, 1.5]));
  map.addLayer(outline("buildings-stirring", "stirring", 1.8, 1, [2, 1.3]));
  map.addLayer(outline("buildings-active", "active", 2.4, 1));
  map.addLayer(outline("buildings-urgent", "urgent", 2.6, 1));
  map.addLayer(outline("regions-quiet", "quiet", 1.6, 0.45, [2, 2]));
  map.addLayer(outline("regions-stirring", "stirring", 2.2, 0.95, [2.2, 1.4]));
  map.addLayer(outline("regions-active", "active", 2.8, 1));
  map.addLayer(outline("regions-urgent", "urgent", 3, 1));
  map.addLayer({
    id: "reporting",
    type: "line",
    source: "reporting",
    paint: { "line-color": "#8AA0B8", "line-width": 1.4, "line-opacity": 0.85 },
  });
  map.addLayer({
    id: "movement",
    type: "line",
    source: "movement",
    paint: { "line-color": "#243044", "line-width": 1, "line-opacity": 0.9, "line-dasharray": [2, 2] },
  });
  map.addLayer({
    id: "facilities",
    type: "circle",
    source: "facilities",
    paint: {
      "circle-radius": 4,
      "circle-color": ["get", "color"],
      "circle-opacity": 0.35,
      "circle-stroke-width": 1.5,
      "circle-stroke-color": ["get", "color"],
    },
  });
}

function pulse(map: MapLibreMap, layerIds: string[]) {
  cancelAnimationFrame(pulseFrame);
  const start = performance.now();
  const step = (now: number) => {
    if (!map.getStyle()) return;
    const t = Math.min(1, Math.max(0, (now - start) / 700));
    const opacity = t >= 1 ? 1 : 1 - 0.55 * Math.sin(t * Math.PI);
    for (const id of layerIds) {
      if (map.getLayer(id)) map.setPaintProperty(id, "line-opacity", opacity);
    }
    if (t < 1) pulseFrame = requestAnimationFrame(step);
  };
  pulseFrame = requestAnimationFrame(step);
}

export function syncScene(map: MapLibreMap, input: SceneInput, reduced: boolean) {
  if (!map.getSource("buildings")) return;
  cancelAnimationFrame(heightFrame);
  const buildings = paintBuildings(input);
  const from = new Map(shownHeights);
  const rising = buildings.features.filter((feature) => {
    const level = Number(feature.properties?.level ?? 0);
    const urgent = feature.properties?.urgent === 1;
    if (level < 3 && !urgent) return false;
    const target = Number(feature.properties?.height ?? 0);
    return (from.get(featureKey(feature)) ?? 0) < target;
  });
  const started = performance.now();
  const duration = reduced ? 0 : 520;
  const tick = (now: number) => {
    if (!map.getSource("buildings")) return;
    const t = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
    const eased = 1 - (1 - t) ** 3;
    const features = buildings.features.map((feature) => {
      const key = featureKey(feature);
      const target = Number(feature.properties?.height ?? 0);
      const height = (from.get(key) ?? 0) + (target - (from.get(key) ?? 0)) * eased;
      shownHeights.set(key, height);
      return { ...feature, properties: { ...feature.properties, height } };
    });
    source(map, "buildings").setData({ type: "FeatureCollection", features });
    if (t < 1) heightFrame = requestAnimationFrame(tick);
  };
  tick(performance.now());
  source(map, "paths").setData(paintPaths(input));
  source(map, "regions").setData(paintRegions(input));
  source(map, "facilities").setData(paintFacilities(input));
  if (reduced || rising.length === 0) return;
  const layers = ["buildings-active", "regions-active"];
  if (rising.some((feature) => feature.properties?.urgent === 1)) layers.push("buildings-urgent", "regions-urgent");
  pulse(map, layers);
}
