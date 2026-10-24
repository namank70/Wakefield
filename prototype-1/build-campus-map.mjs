import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(repo, "src", "data", "geo", file), "utf8"));
const buildings = read("buildings.json").features;
const streets = read("street-lines.json").features;
const paths = read("paths.json").features;
const boundaries = read("boundaries.json").features;
const W = 1600, H = 900;
const box = { west: -121.8900, east: -121.8740, south: 37.3285, north: 37.3425 };

function sourcePoint([lon, lat]) {
  return [(lon - box.west) / (box.east - box.west) * W, (box.north - lat) / (box.north - box.south) * H];
}
function allCoords(value, out = []) {
  if (typeof value[0] === "number") out.push(value);
  else for (const child of value) allCoords(child, out);
  return out;
}
const projected = [...buildings, ...streets, ...paths, ...boundaries].flatMap((feature) => allCoords(feature.geometry.coordinates).map(sourcePoint));
const angle = 17 * Math.PI / 180;
const rotated = projected.map(([x, y]) => {
  const dx = x - W / 2, dy = y - H / 2;
  return [W / 2 + dx * Math.cos(angle) - dy * Math.sin(angle), H / 2 + dx * Math.sin(angle) + dy * Math.cos(angle)];
});
const extent = { minX: Math.min(...rotated.map((p) => p[0])), maxX: Math.max(...rotated.map((p) => p[0])), minY: Math.min(...rotated.map((p) => p[1])), maxY: Math.max(...rotated.map((p) => p[1])) };
function point(coordinate) {
  const [x0, y0] = sourcePoint(coordinate);
  const dx = x0 - W / 2, dy = y0 - H / 2;
  const x = W / 2 + dx * Math.cos(angle) - dy * Math.sin(angle);
  const y = H / 2 + dx * Math.sin(angle) + dy * Math.cos(angle);
  const xx = 30 + (x - extent.minX) / (extent.maxX - extent.minX) * (W - 60);
  const yy = 22 + (y - extent.minY) / (extent.maxY - extent.minY) * (H - 44);
  const t = yy / H;
  const perspective = 0.68 + 0.42 * t;
  // Integer-pixel coordinates and compact path syntax keep the SVG small enough
  // for Studio's per-file upload limit without visibly changing the map.
  return [Math.round(W / 2 + (xx - W / 2) * perspective), Math.round(55 + yy * 0.87)];
}
function linePath(coords, close = false) {
  const pts = coords.map(point);
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("") + (close ? "Z" : "");
}
function geometryPaths(geometry) {
  const paths = [];
  function visit(coords, isRing = false) {
    if (typeof coords[0]?.[0] === "number") paths.push(linePath(coords, isRing));
    else for (const child of coords) visit(child, geometry.type.includes("Polygon"));
  }
  visit(geometry.coordinates);
  return paths;
}
function extrusionFaces(geometry, dx = -12, dy = -25) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((rings) => {
    const ring = rings[0] ?? [];
    return ring.slice(0, -1).map((coordinate, index) => {
      const next = ring[index + 1];
      const [x1, y1] = point(coordinate), [x2, y2] = point(next);
      return `M${x1} ${y1} L${x2} ${y2} L${x2 + dx} ${y2 + dy} L${x1 + dx} ${y1 + dy} Z`;
    });
  });
}
function centroid(feature) {
  const coords = allCoords(feature.geometry.coordinates);
  return [coords.reduce((sum, p) => sum + p[0], 0) / coords.length, coords.reduce((sum, p) => sum + p[1], 0) / coords.length];
}
function esc(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

const chunks = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="SJSU campus streets and building footprints">
<defs><linearGradient id="campusBg" x2="0" y2="1"><stop stop-color="#081323"/><stop offset="1" stop-color="#050b15"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect width="${W}" height="${H}" fill="url(#campusBg)"/>
<g class="footprints">`];
for (const feature of buildings) {
  const name = feature.properties?.name;
  const tower = name === "Tower Hall";
  const band = feature.properties?.band;
  const d = geometryPaths(feature.geometry).join(" ");
  if (tower) {
    chunks.push(`<g fill="#087f9d" stroke="#1bb4d1" stroke-width="1.1" fill-opacity=".9">${extrusionFaces(feature.geometry).map((face) => `<path d="${face}"/>`).join("")}</g>`);
    chunks.push(`<path d="${d}" fill="#26d9ff" fill-opacity=".52" stroke="#76edff" stroke-width="2" filter="url(#glow)"/>`);
  } else {
    chunks.push(`<path d="${d}" fill="${band === "block" ? "#0c1422" : "#111a2c"}" fill-opacity="${band === "block" ? ".44" : ".72"}" stroke="${band === "block" ? "#62758f" : "#8297b2"}" stroke-width="${band === "block" ? ".8" : "1.05"}" stroke-opacity="${band === "block" ? ".56" : ".9"}" ${band === "block" ? 'stroke-dasharray="2 2"' : ""}/>`);
  }
}
chunks.push(`</g><g class="campus-paths">`);
for (const feature of paths) chunks.push(`<path d="${geometryPaths(feature.geometry).join(" ")}" fill="none" stroke="#536985" stroke-width="1.4" stroke-opacity=".85"/>`);
chunks.push(`</g><g class="campus-streets">`);
for (const feature of streets) {
  const outer = feature.properties?.ring === "outer";
  const edge = feature.properties?.ring === "edge";
  chunks.push(`<path d="${geometryPaths(feature.geometry).join(" ")}" fill="none" stroke="${outer ? "#d5e2f2" : edge ? "#566b88" : "#8ea3bd"}" stroke-width="${outer ? "2.5" : edge ? "2.1" : "1.55"}" stroke-opacity="${outer ? ".95" : edge ? ".78" : ".67"}"/>`);
}
chunks.push(`</g><g class="map-labels">`);
const preferred = new Set(["MLK Library", "Tower Hall", "Engineering", "Student Union"]);
const labelCandidates = [];
for (const feature of buildings) {
  const name = feature.properties?.name;
  if (!name || feature.properties?.band === "block") continue;
  const [x, y] = point(centroid(feature));
  const short = name.replace("Doctor Martin Luther King Junior Library", "MLK Library").replace("Charles W. Davidson College of Engineering", "Engineering").replace("Diaz Compean Student Union", "Student Union");
  const size = preferred.has(short) ? 16 : 11;
  labelCandidates.push({ x, y, size, text: short, priority: preferred.has(short) ? 2 : 1, width: short.length * size * .62 + 12, height: size * 1.5 + 7 });
}
labelCandidates.sort((a, b) => b.priority - a.priority || b.size - a.size || a.text.localeCompare(b.text));
const acceptedLabels = [];
for (const label of labelCandidates) {
  const bounds = { left: label.x - label.width / 2, right: label.x + label.width / 2, top: label.y - label.height, bottom: label.y + 4 };
  const crowded = acceptedLabels.some((other) => bounds.left < other.right + 9 && bounds.right > other.left - 9 && bounds.top < other.bottom + 7 && bounds.bottom > other.top - 7);
  if (crowded) continue;
  acceptedLabels.push(bounds);
  chunks.push(`<text x="${label.x}" y="${label.y}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${label.size}" fill="#e7eef8" stroke="#070b14" stroke-width="2.4" paint-order="stroke" opacity=".95">${esc(label.text)}</text>`);
}
chunks.push(`</g><g class="road-labels" font-family="Consolas,monospace" font-size="15" letter-spacing="2" fill="#e2ebf6" stroke="#070b14" stroke-width="3" paint-order="stroke"><text x="210" y="238">SANTA CLARA ST</text><text x="1170" y="192">11TH ST</text><text x="405" y="812">4TH ST</text><text x="1160" y="724">SAN SALVADOR ST</text><text x="570" y="280">SAN FERNANDO ST</text></g>
<g class="tower-health"><rect x="642" y="420" width="84" height="14" rx="7" fill="#162033" stroke="#8b5cf6" stroke-width="2"/><rect x="644" y="422" width="56" height="10" rx="5" fill="#8b5cf6"/><text x="685" y="454" text-anchor="middle" font-family="Consolas,monospace" font-size="12" fill="#d9e5f3">70</text></g>
</svg>`);
const handoffDir = path.join(dir, "studio-handoff");
fs.mkdirSync(handoffDir, { recursive: true });
fs.writeFileSync(path.join(handoffDir, "campus-map.svg"), chunks.join(""), "utf8");
console.log(`Wrote studio-handoff/campus-map.svg from ${buildings.length} buildings, ${streets.length} street lines, and ${paths.length} campus paths.`);
