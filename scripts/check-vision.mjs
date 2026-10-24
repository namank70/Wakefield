import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv.find((arg) => arg.startsWith("--base="))?.slice(7) || "http://127.0.0.1:3001").replace(/\/$/, "");
const all = process.argv.includes("--all");
const categoryIds = ["lighting", "walkway_obstruction", "trash_overflow", "bike_scooter_parking", "water_leak", "door_lock", "printer_technology", "accessibility_barrier", "other"];

async function sendImage(filename, uploadName = "photo.jpg") {
  // Match browser compression without altering source assets.
  const sharp = (await import("sharp")).default;
  const bytes = await sharp(await readFile(join(root, "public", "demo", filename))).resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
  const body = new FormData(); body.set("image", new Blob([bytes], { type: "image/jpeg" }), uploadName);
  const response = await fetch(`${base}/api/analyze`, { method: "POST", body, signal: AbortSignal.timeout(310000) });
  const value = await response.json();
  assert.equal(response.status, 200, JSON.stringify(value));
  assert.equal(value.provider, "ollama");
  assert.ok(categoryIds.includes(value.category));
  assert.ok(["low", "medium", "high", "urgent"].includes(value.severity));
  assert.equal(typeof value.issueDetected, "boolean");
  assert.ok(value.summary?.length > 4 && value.rationale?.length > 4);
  assert.ok(value.confidence >= 0 && value.confidence <= 1);
  console.log(`${filename}: ${value.category} / ${value.severity} / ${value.department}; issue=${value.issueDetected}; ${value.durationMs}ms${value.cacheHit ? " (cached)" : ""}`);
  console.log(`  ${value.rationale}`);
  return value;
}

try {
  let status = await (await fetch(`${base}/api/vision/status`)).json();
  console.log(`Checking the photo API through ${base}`);
  const missing = await fetch(`${base}/api/analyze`, { method: "POST", body: new FormData() });
  assert.equal(missing.status, 400);
  const bad = new FormData(); bad.set("image", new Blob(["not a photo"], { type: "image/png" }), "report.png");
  assert.equal((await fetch(`${base}/api/analyze`, { method: "POST", body: bad })).status, 415);
  const denied = new FormData(); denied.set("image", new Blob(["x"], { type: "image/png" }));
  assert.equal((await fetch(`${base}/api/analyze`, { method: "POST", headers: { origin: "https://unrelated.example" }, body: denied })).status, 403);
  if (process.argv.includes("--requests-only")) {
    console.log(`Invalid-request checks passed. Model status: ${status.message}`);
  } else {
  if (process.argv.includes("--wait-for-model")) {
    for (let attempt = 0; !status.ready && attempt < 360; attempt++) {
      if (attempt % 6 === 0) console.log(`Waiting for local model setup: ${status.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      status = await (await fetch(`${base}/api/vision/status`)).json();
    }
  }
  assert.equal(status.ready, true, status.message);
  assert.equal(status.provider, "ollama");
  console.log(`Testing real inference with ${status.model}`);
  const failures = [];
  function check(name, assertion) { try { assertion(); } catch (error) { failures.push(`${name}: ${error.message}`); } }
  const clear = await sendImage("campus-clear-bike-rack.png", "urgent-flood.png");
  check("Clear route", () => assert.equal(clear.issueDetected, false, "The clear-route control must not invent an issue from the upload name."));
  const renamed = await sendImage("campus-clear-bike-rack.png", "clear-photo.png");
  assert.equal(renamed.cacheHit, true);
  for (const key of ["category", "severity", "department", "issueDetected"]) assert.equal(renamed[key], clear[key]);
  const water = await sendImage("engineering-electrical-leak.png", "normal.jpg");
  check("Visible electrical/water hazard", () => {
    assert.equal(water.issueDetected, true);
    assert.equal(water.category, "water_leak");
    assert.equal(water.severity, "urgent");
    assert.equal(water.department, "Facilities Plumbing");
  });
  const ramp = await sendImage("library-ramp-blocked.png");
  check("Blocked accessible ramp", () => {
    assert.equal(ramp.issueDetected, true);
    assert.equal(ramp.accessibilityImpact, true);
    assert.ok(["high", "urgent"].includes(ramp.severity));
  });
  if (all) for (const filename of ["library-water-leak.png", "library-overflowing-bin.png", "engineering-broken-door.png", "campus-cracked-walkway.png", "union-blocked-aisle.png", "fusedLight.jpeg", "chairsScattered.jpeg", "brokenchair.jpeg", "bikeRACK.jpeg"]) await sendImage(filename);
  assert.equal(failures.length, 0, failures.join("\n"));
  console.log("Vision integration checks passed: real image inference, structured fields, clear-route rejection, routing, file-name independence and invalid-request handling.");
  }
} catch (error) {
  console.error(error instanceof Error ? `${error.message}${error.cause ? ` (${error.cause.code || error.cause})` : ""}` : error);
  process.exitCode = 1;
}
