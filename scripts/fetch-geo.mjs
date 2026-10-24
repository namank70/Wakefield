import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const geoDir = join(root, "src", "data", "geo");
const retrievedAt = new Date().toISOString().slice(0, 10);

const bbox = {
  south: 37.331,
  west: -121.89,
  north: 37.341,
  east: -121.876,
};

const query = `
[out:json][timeout:120];
(
  way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  relation["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["highway"~"footway|path|pedestrian|steps|cycleway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["highway"]["name"~"San Fernando|San Salvador|Santa Clara|William|3rd Street|4th Street|10th Street|11th Street"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["entrance"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["amenity"="bicycle_parking"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["amenity"="bicycle_parking"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way(25774796);
  way(25774628);
  way(25774831);
  relation(22601);
);
out geom;
`;

const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function fetchOverpass() {
  let lastError;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "WakefieldCampusMap/0.1 (hackathon prototype)",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) {
        lastError = new Error(`${endpoint} returned ${response.status}`);
        continue;
      }
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function closeRing(coords) {
  if (coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push([first[0], first[1]]);
  return coords;
}

function geometryFromNodes(nodes) {
  return nodes.map((node) => [node.lon, node.lat]);
}

function wayFeature(element, geometryType) {
  if (!element.geometry || element.geometry.length < 2) return null;
  const coords = geometryFromNodes(element.geometry);
  const closed =
    coords.length >= 4 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1];
  const asPolygon = geometryType === "polygon" || (geometryType !== "line" && closed);
  if (asPolygon && coords.length < 4) return null;
  const geometry = asPolygon
    ? { type: "Polygon", coordinates: [closeRing(coords)] }
    : { type: "LineString", coordinates: coords };
  return featureFrom(element, geometry);
}

function relationFeature(element) {
  const outers = (element.members ?? []).filter((member) => member.role === "outer" && member.geometry?.length >= 4);
  if (outers.length === 0) return null;
  const polygons = outers
    .map((member) => closeRing(geometryFromNodes(member.geometry)))
    .filter((ring) => ring.length >= 4)
    .map((ring) => turf.polygon([ring]));
  if (polygons.length === 0) return null;
  let combined = polygons[0];
  for (const polygon of polygons.slice(1)) {
    const unioned = turf.union(turf.featureCollection([combined, polygon]));
    if (unioned) combined = unioned;
  }
  return featureFrom(element, combined.geometry);
}

function featureFrom(element, geometry) {
  const tags = element.tags ?? {};
  const id = `${element.type}-${element.id}`;
  return {
    type: "Feature",
    id,
    properties: {
      id,
      osmType: element.type,
      osmId: element.id,
      name: tags.name ?? null,
      highway: tags.highway ?? null,
      amenity: tags.amenity ?? null,
      entrance: tags.entrance ?? null,
      wheelchair: tags.wheelchair ?? null,
      building: tags.building ?? null,
    },
    geometry,
  };
}

function pointFeature(element) {
  return {
    type: "Feature",
    id: `node-${element.id}`,
    properties: {
      id: `node-${element.id}`,
      osmType: "node",
      osmId: element.id,
      name: element.tags?.name ?? null,
      amenity: element.tags?.amenity ?? null,
      entrance: element.tags?.entrance ?? null,
      wheelchair: element.tags?.wheelchair ?? null,
      kind: element.tags?.amenity === "bicycle_parking" ? "bicycle_parking" : "entrance",
    },
    geometry: { type: "Point", coordinates: [element.lon, element.lat] },
  };
}

function collection(features) {
  return { type: "FeatureCollection", features };
}

function streetKey(name) {
  if (!name) return null;
  if (/San Fernando/i.test(name)) return "san-fernando";
  if (/San Salvador/i.test(name)) return "san-salvador";
  if (/Santa Clara/i.test(name)) return "santa-clara";
  if (/William/i.test(name)) return "william";
  if (/(^|\s)4th Street$/i.test(name)) return "4th";
  if (/(^|\s)10th Street$/i.test(name)) return "10th";
  if (/(^|\s)3rd Street$/i.test(name)) return "3rd";
  if (/(^|\s)11th Street$/i.test(name)) return "11th";
  return null;
}

function mergeLines(features) {
  const lines = features
    .filter((feature) => feature.geometry.type === "LineString")
    .map((feature) => feature.geometry.coordinates);
  if (lines.length === 0) return null;
  return turf.multiLineString(lines);
}

function flattenLines(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [turf.lineString(geometry.coordinates)];
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates.map((coordinates) => turf.lineString(coordinates));
  }
  return [];
}

function nearestIntersection(a, b, target, label) {
  if (!a || !b) throw new Error(`Missing street geometry for ${label}`);
  const hits = turf.lineIntersect(a, b).features;
  if (hits.length === 0) throw new Error(`No intersection for ${label}`);
  const targetPoint = turf.point(target);
  hits.sort(
    (left, right) => turf.distance(left, targetPoint) - turf.distance(right, targetPoint),
  );
  return hits[0].geometry.coordinates;
}

function closestApproach(a, b) {
  let best = Infinity;
  let onA = null;
  let onB = null;
  for (const line of flattenLines(a.geometry)) {
    for (const coordinate of line.geometry.coordinates) {
      for (const other of flattenLines(b.geometry)) {
        const snapped = turf.nearestPointOnLine(other, turf.point(coordinate));
        const distance = turf.distance(turf.point(coordinate), snapped, { units: "kilometers" });
        if (distance < best) {
          best = distance;
          onA = coordinate;
          onB = snapped.geometry.coordinates;
        }
      }
    }
  }
  return {
    meters: best * 1000,
    midpoint: [(onA[0] + onB[0]) / 2, (onA[1] + onB[1]) / 2],
  };
}

function extremeVertex(line, preferEast) {
  let chosen = null;
  for (const part of flattenLines(line.geometry)) {
    for (const coordinate of part.geometry.coordinates) {
      if (!chosen) chosen = coordinate;
      else if (preferEast && coordinate[0] > chosen[0]) chosen = coordinate;
      else if (!preferEast && coordinate[0] < chosen[0]) chosen = coordinate;
    }
  }
  return chosen;
}

function clipPolygon(feature, boundary) {
  try {
    const polygon =
      feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon"
        ? feature
        : null;
    if (!polygon) return null;
    if (!turf.booleanIntersects(polygon, boundary)) return null;
    const clipped = turf.intersect(turf.featureCollection([polygon, boundary]));
    if (!clipped) return null;
    return { ...feature, geometry: clipped.geometry };
  } catch {
    return null;
  }
}

function clipLine(feature, boundary) {
  try {
    if (feature.geometry.type !== "LineString") return null;
    const line = turf.lineString(feature.geometry.coordinates);
    if (turf.booleanWithin(line, boundary)) return feature;
    if (!turf.booleanIntersects(line, boundary)) return null;
    const splitter = turf.polygonToLine(boundary);
    const split = turf.lineSplit(line, splitter);
    const kept = split.features.filter((piece) => {
      if (piece.geometry.coordinates.length < 2) return false;
      const midpoint = turf.along(piece, turf.length(piece) / 2);
      return turf.booleanPointInPolygon(midpoint, boundary);
    });
    if (kept.length === 0) return null;
    if (kept.length === 1) return { ...feature, geometry: kept[0].geometry };
    return {
      ...feature,
      geometry: { type: "MultiLineString", coordinates: kept.map((piece) => piece.geometry.coordinates) },
    };
  } catch {
    return null;
  }
}

function centroidOf(feature) {
  const point = turf.centroid(feature);
  return point.geometry.coordinates;
}

function writeJson(name, value) {
  writeFileSync(join(geoDir, name), `${JSON.stringify(value)}\n`);
}

const cachePath = join(root, "scripts", ".cache", "overpass.json");
mkdirSync(dirname(cachePath), { recursive: true });
const payload = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : await fetchOverpass();
if (!existsSync(cachePath)) writeFileSync(cachePath, JSON.stringify(payload));
const elements = payload.elements ?? [];
mkdirSync(geoDir, { recursive: true });

const streets = {
  "san-fernando": [],
  "san-salvador": [],
  "santa-clara": [],
  william: [],
  "4th": [],
  "10th": [],
  "3rd": [],
  "11th": [],
};

const buildings = [];
const paths = [];
const facilities = [];
const namedWays = new Map();

for (const element of elements) {
  if (element.type === "way" && element.tags?.highway && streetKey(element.tags.name)) {
    const feature = wayFeature(element, "line");
    if (feature) streets[streetKey(element.tags.name)].push(feature);
  }
  if (element.type === "way" && element.tags?.building) {
    const feature = wayFeature(element, "polygon");
    if (feature) {
      buildings.push(feature);
      namedWays.set(element.id, feature);
    }
  }
  if (element.type === "relation" && element.tags?.building) {
    const feature = relationFeature(element);
    if (feature) namedWays.set(element.id, feature);
  }
  if (
    element.type === "way" &&
    element.tags?.highway &&
    /footway|path|pedestrian|steps|cycleway/.test(element.tags.highway)
  ) {
    const feature = wayFeature(element, "line");
    if (feature) paths.push(feature);
  }
  if (element.type === "node" && (element.tags?.entrance || element.tags?.amenity === "bicycle_parking")) {
    facilities.push(pointFeature(element));
  }
  if (element.type === "way" && element.tags?.amenity === "bicycle_parking") {
    const feature = wayFeature(element, "polygon");
    if (feature) {
      feature.properties.kind = "bicycle_parking";
      facilities.push(feature);
    }
  }
}

const streetLines = Object.fromEntries(
  Object.entries(streets).map(([key, features]) => [key, mergeLines(features)]),
);

for (const [key, line] of Object.entries(streetLines)) {
  console.log(`${key}: ${line ? line.geometry.coordinates.length : 0} segments`);
}

const reportingRing = [
  nearestIntersection(streetLines["4th"], streetLines["san-fernando"], [-121.886057, 37.335829], "4th & San Fernando"),
  nearestIntersection(streetLines["10th"], streetLines["san-fernando"], [-121.879716, 37.338872], "10th & San Fernando"),
  nearestIntersection(streetLines["10th"], streetLines["san-salvador"], [-121.876497, 37.334537], "10th & San Salvador"),
  nearestIntersection(streetLines["4th"], streetLines["san-salvador"], [-121.882838, 37.331528], "4th & San Salvador"),
];
reportingRing.push(reportingRing[0]);

const eleventhSantaClara = closestApproach(streetLines["11th"], streetLines["santa-clara"]);
if (eleventhSantaClara.meters > 50) {
  throw new Error(`11th and Santa Clara are ${Math.round(eleventhSantaClara.meters)}m apart`);
}
const eleventhSanSalvador = nearestIntersection(
  streetLines["11th"],
  streetLines["san-salvador"],
  [-121.875445, 37.335037],
  "11th & San Salvador",
);
const williamEast = extremeVertex(streetLines.william, true);
const williamWest = extremeVertex(streetLines.william, false);

const movementRing = [
  nearestIntersection(streetLines["3rd"], streetLines["santa-clara"], [-121.888502, 37.337167], "3rd & Santa Clara"),
  eleventhSantaClara.midpoint,
  eleventhSanSalvador,
  williamEast,
  williamWest,
];
movementRing.push(movementRing[0]);
console.log("11th/Santa Clara gap m", Math.round(eleventhSantaClara.meters));

const reporting = turf.polygon([reportingRing], {
  id: "reporting-boundary",
  kind: "reporting",
  name: "SJSU Main Campus reporting boundary",
});
const movement = turf.polygon([movementRing], {
  id: "movement-boundary",
  kind: "movement",
  name: "One-block movement boundary",
});

function landmark(id, name, regionId, feature) {
  if (!feature) throw new Error(`Missing landmark feature ${id}`);
  const [longitude, latitude] = centroidOf(feature);
  return { id, name, regionId, longitude, latitude, osmId: `${feature.properties.osmType}/${feature.properties.osmId}` };
}

const libraryFeature = namedWays.get(25774796) ?? buildings.find((feature) => feature.properties.osmId === 25774796);
const towerFeature = namedWays.get(25774628) ?? buildings.find((feature) => feature.properties.osmId === 25774628);
const engineeringFeature = namedWays.get(22601);
const unionFeature = namedWays.get(25774831) ?? buildings.find((feature) => feature.properties.osmId === 25774831);

const landmarkRecords = [
  landmark("library", "Dr. Martin Luther King Jr. Library", "library", libraryFeature),
  landmark("tower", "Tower Hall", "tower", towerFeature),
  landmark("engineering", "Charles W. Davidson College of Engineering", "engineering", engineeringFeature),
  landmark("student-union", "Diaz Compean Student Union", "student-union", unionFeature),
];

for (const feature of buildings) {
  const match = landmarkRecords.find((item) => item.osmId === `${feature.properties.osmType}/${feature.properties.osmId}`);
  if (match) feature.properties.landmarkId = match.id;
}
if (engineeringFeature) engineeringFeature.properties.landmarkId = "engineering";

const regionFeatures = [
  { id: "library", name: "MLK Library", feature: libraryFeature },
  { id: "engineering", name: "Engineering", feature: engineeringFeature },
  { id: "student-union", name: "Student Union", feature: unionFeature },
].map(({ id, name, feature }) => ({
  type: "Feature",
  id: `region-${id}`,
  properties: { id, kind: "region", name },
  geometry: feature.geometry,
}));

if (engineeringFeature && !buildings.some((feature) => feature.properties.osmId === 22601)) {
  buildings.push(engineeringFeature);
}

const clippedBuildings = buildings
  .map((feature) => clipPolygon(feature, reporting))
  .filter(Boolean);
for (const feature of clippedBuildings) feature.properties.band = "campus";

const contextBuildings = buildings
  .map((feature) => {
    const clipped = clipPolygon(feature, movement);
    if (!clipped) return null;
    if (turf.booleanPointInPolygon(turf.centroid(clipped), reporting)) return null;
    clipped.properties = { ...clipped.properties, band: "block" };
    return clipped;
  })
  .filter(Boolean);
const clippedPaths = paths.map((feature) => clipLine(feature, reporting)).filter(Boolean);
const clippedFacilities = facilities.filter((feature) => {
  const point =
    feature.geometry.type === "Point"
      ? turf.point(feature.geometry.coordinates)
      : turf.centroid(feature);
  return turf.booleanPointInPolygon(point, reporting);
});

const labelSpecs = [
  ["san-fernando", "San Fernando St", "north", 0],
  ["10th", "10th St", "east", 1],
  ["san-salvador", "San Salvador St", "south", 2],
  ["4th", "4th St", "west", 3],
];
const labelPoints = labelSpecs.map(([key, name, edge, index]) => {
  const start = reportingRing[index];
  const end = reportingRing[index + 1];
  return {
    type: "Feature",
    id: `label-${key}`,
    properties: { id: `label-${key}`, name, edge },
    geometry: { type: "Point", coordinates: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] },
  };
});

writeJson("buildings.json", collection([...clippedBuildings, ...contextBuildings]));
writeJson("paths.json", collection(clippedPaths));
writeJson("facilities.json", collection(clippedFacilities));
writeJson(
  "boundaries.json",
  collection([
    { ...reporting, id: "reporting-boundary", properties: { ...reporting.properties, id: "reporting-boundary" } },
    { ...movement, id: "movement-boundary", properties: { ...movement.properties, id: "movement-boundary" } },
    ...regionFeatures,
  ]),
);
const outerLabels = [
  ["santa-clara", "Santa Clara St", movementRing[0], movementRing[1]],
  ["11th", "11th St", movementRing[1], movementRing[2]],
  ["william", "William St", movementRing[3], movementRing[4]],
  ["3rd", "3rd St", movementRing[4], movementRing[0]],
].map(([key, name, start, end]) => ({
  type: "Feature",
  id: `label-outer-${key}`,
  properties: { id: `label-outer-${key}`, name, edge: "outer" },
  geometry: { type: "Point", coordinates: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] },
}));
writeJson("streets.json", collection([...labelPoints, ...outerLabels]));

const outerKeys = new Set(["santa-clara", "william", "3rd", "11th"]);
const frameFeatures = [];
for (const [key, line] of Object.entries(streetLines)) {
  if (!line) continue;
  flattenLines(line.geometry ?? line).forEach((part, index) => {
    frameFeatures.push({
      type: "Feature",
      id: `street-${key}-${index}`,
      properties: { id: `street-${key}-${index}`, name: key, ring: outerKeys.has(key) ? "outer" : "edge" },
      geometry: part.geometry,
    });
  });
}
writeJson("street-lines.json", collection(frameFeatures));

for (const record of landmarkRecords) {
  const point = turf.point([record.longitude, record.latitude]);
  if (!turf.booleanPointInPolygon(point, reporting)) {
    throw new Error(`${record.id} centroid is outside the reporting boundary`);
  }
}

const libraryCenter = turf.centroid(libraryFeature);
const southEdgeMid = turf.point([
  (reportingRing[2][0] + reportingRing[3][0]) / 2,
  (reportingRing[2][1] + reportingRing[3][1]) / 2,
]);
const seededBearing = turf.bearing(libraryCenter, southEdgeMid);
let seeded = turf.destination(libraryCenter, 0.02, seededBearing, { units: "kilometers" });
if (turf.booleanPointInPolygon(seeded, libraryFeature)) {
  seeded = turf.destination(libraryCenter, 0.08, seededBearing, { units: "kilometers" });
}
if (!turf.booleanPointInPolygon(seeded, reporting) || turf.booleanPointInPolygon(seeded, libraryFeature)) {
  throw new Error("Seeded library pin is not on campus outside the library footprint");
}

const landmarksSource = `/* Generated by scripts/fetch-geo.mjs on ${retrievedAt}. Do not hand-edit coordinates. */
export type Landmark = {
  id: "library" | "tower" | "engineering" | "student-union";
  name: string;
  regionId: string;
  longitude: number;
  latitude: number;
  osmId: string;
};

export const landmarks: Landmark[] = ${JSON.stringify(landmarkRecords, null, 2)};

export const seededLibraryPin = {
  longitude: ${seeded.geometry.coordinates[0]},
  latitude: ${seeded.geometry.coordinates[1]},
  label: "Seeded SJSU pin, south side of Dr. Martin Luther King Jr. Library",
};
`;
writeFileSync(join(geoDir, "landmarks.ts"), `${landmarksSource}\n`);

const entranceCount = clippedFacilities.filter((feature) => feature.properties.kind === "entrance" || feature.properties.entrance).length;
const bikeCount = clippedFacilities.filter((feature) => feature.properties.kind === "bicycle_parking" || feature.properties.amenity === "bicycle_parking").length;

const source = `# Geographic sources

Retrieved: ${retrievedAt}

Geometry is from OpenStreetMap, licensed under the Open Database License (ODbL) 1.0.
© OpenStreetMap contributors. https://www.openstreetmap.org/copyright

Query endpoint: Overpass API. The app reads the files in this folder and does not query Overpass at runtime.

## What was saved

- Campus building footprints and pathway centerlines are clipped to the reporting boundary.
- The one-block margin keeps the buildings whose centroids fall between the reporting boundary and the movement boundary, plus the named street centerlines, so the surrounding block stays readable.
- Perimeter labels: San Fernando, San Salvador, 4th, 10th, and the outer streets Santa Clara, William, 3rd, and 11th.
- Engineering region from the OpenStreetMap relation for the Charles W. Davidson College of Engineering (relation 22601).
- Pathway centerlines tagged footway, path, pedestrian, steps, or cycleway.
- Mapped entrances: ${entranceCount}. Mapped bicycle parking features: ${bikeCount}.

## Boundaries

The reporting boundary is the polygon formed by the nearest OpenStreetMap intersections of:

- South 4th Street and East San Fernando Street
- South 10th Street and East San Fernando Street
- South 10th Street and East San Salvador Street
- South 4th Street and East San Salvador Street

The movement boundary is the next surrounding street, not a meter buffer around campus:

- North: East Santa Clara Street, from South 3rd Street to the closest approach of South 11th Street
- West: the South 3rd Street bearing, from East Santa Clara Street through the mapped west end of East William Street
- South: East William Street between its mapped west and east ends
- East: South 11th Street from East Santa Clara Street to East San Salvador Street, then a short jog to the mapped east end of East William Street

Recorded data gaps, left as gaps instead of invented corners:

- South 11th Street and East Santa Clara Street do not share a node. Their centerlines approach within about 34 meters. The northeast corner is the midpoint of that approach.
- Named South 11th Street geometry ends at East San Salvador Street. Named East William Street ends near South 10th Street, about 27 meters from 10th and about 213 meters from 11th. The southeast block between 11th and William is not closed with a shared intersection, so the boundary follows 11th to San Salvador and then William's mapped east end.
- Named South 3rd Street ends at East San Salvador Street. East William Street's west end sits on the same bearing as 3rd, one block south of San Salvador. The southwest edge uses that mapped William endpoint.

## Gaps

Accessible routes are not included. OpenStreetMap entrance and bicycle-parking features are shown only where the extract contained them. Missing facility classes stay off the map. Nothing in this folder is a verified safe route.
`;
writeFileSync(join(geoDir, "SOURCE.md"), source);

console.log("landmarks", landmarkRecords);
console.log("reporting", reportingRing);
console.log("movement", movementRing);
console.log("buildings", clippedBuildings.length, "context", contextBuildings.length, "streets", frameFeatures.length, "paths", clippedPaths.length, "facilities", clippedFacilities.length);
console.log("entrances", entranceCount, "bicycle parking", bikeCount);
