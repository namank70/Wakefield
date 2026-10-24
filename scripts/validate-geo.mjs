import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const landmarks = readFileSync(join(root, "src/data/geo/landmarks.ts"), "utf8");
const boundaries = JSON.parse(readFileSync(join(root, "src/data/geo/boundaries.json"), "utf8"));

function record(id) {
  const match = landmarks.match(new RegExp(`"id": "${id}"[\\s\\S]*?"longitude": ([\\d.-]+),\\s*"latitude": ([\\d.-]+)`));
  if (!match) throw new Error(`Missing landmark ${id}`);
  return { longitude: Number(match[1]), latitude: Number(match[2]) };
}

const library = record("library");
const tower = record("tower");
const engineering = record("engineering");
const union = record("student-union");
const reporting = boundaries.features.find((feature) => feature.properties.id === "reporting-boundary");
const movement = boundaries.features.find((feature) => feature.properties.id === "movement-boundary");

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

check(library.longitude < tower.longitude, "MLK Library should be west of Tower Hall");
check(library.latitude > tower.latitude, "MLK Library should be north of Tower Hall");
check(engineering.latitude > library.latitude, "Engineering should be north of MLK Library");
check(engineering.longitude > library.longitude, "Engineering should be east of MLK Library");
check(union.latitude < engineering.latitude, "Student Union should be south of Engineering");
check(reporting?.geometry?.coordinates?.[0]?.length >= 4, "Reporting boundary is missing");
check(movement?.geometry?.coordinates?.[0]?.length >= 4, "Movement boundary is missing");

const ring = reporting.geometry.coordinates[0];
const northLat = (ring[0][1] + ring[1][1]) / 2;
const southLat = (ring[2][1] + ring[3][1]) / 2;
check(northLat > southLat, "San Fernando edge should be north of the San Salvador edge");
check(ring[0][0] < ring[1][0], "4th Street edge should be west of the 10th Street edge");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Geographic checks passed.");
console.log({ library, tower, engineering, union });
