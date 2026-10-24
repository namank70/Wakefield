/**
 * Server-side EAiSER adapter.
 *
 * The browser must call Wakefield's /api/analyze route, never EAiSER directly.
 * The provider URL, credential and field names are configurable because the
 * native EAiSER contract is supplied by the Momntum team at integration time.
 */

export const CATEGORIES = new Set([
  "lighting",
  "walkway_obstruction",
  "trash_overflow",
  "bike_scooter_parking",
  "water_leak",
  "door_lock",
  "printer_technology",
  "accessibility_barrier",
  "other",
]);

const MAX_IMAGE_BYTES = Number(process.env.EAISER_MAX_IMAGE_BYTES || 10 * 1024 * 1024);

export class EaiserError extends Error {
  constructor(code, message, status = 502, details = {}) {
    super(message);
    this.name = "EaiserError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanOrNull(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "yes" || value === 1 || value === "1") return true;
  if (value === "false" || value === "no" || value === 0 || value === "0") return false;
  return null;
}

function normalizeCategory(value) {
  const category = String(value || "other").trim().toLowerCase().replace(/[ -]+/g, "_");
  return CATEGORIES.has(category) ? category : "other";
}

function normalizeProviderResponse(payload) {
  const result = payload?.result || payload?.data || payload;
  const confidence = numberOrNull(first(result?.confidence, result?.score, result?.probability));
  const normalizedConfidence = confidence !== null && confidence > 1 ? confidence / 100 : confidence;

  return {
    category: normalizeCategory(first(result?.category, result?.classification, result?.label)),
    summary: String(first(result?.summary, result?.description, result?.issue, "Issue identified from submitted image")),
    severity: String(first(result?.severity, "medium")).toLowerCase(),
    department: String(first(result?.department, result?.responsibleDepartment, result?.responsible_department, "Campus services")),
    confidence: normalizedConfidence === null ? 0 : Math.max(0, Math.min(1, normalizedConfidence)),
    accessibilityImpact: booleanOrNull(first(result?.accessibilityImpact, result?.accessibility_impact, result?.accessibility)) ?? false,
    tags: Array.isArray(result?.tags) ? result.tags.map(String).slice(0, 12) : [],
    provider: "eaiser",
  };
}

function validateImage(image) {
  if (!image || typeof image.arrayBuffer !== "function") {
    throw new EaiserError("image_required", "An image file is required.", 400);
  }
  if (image.size > MAX_IMAGE_BYTES) {
    throw new EaiserError("image_too_large", `Image exceeds the ${MAX_IMAGE_BYTES} byte limit.`, 413);
  }
  if (image.type && !image.type.startsWith("image/")) {
    throw new EaiserError("unsupported_file", "Only image files can be analyzed.", 415);
  }
}

export async function analyzeWithEaiser({ image, latitude, longitude, campusId = "sjsu", regionId, buildingId, signal } = {}) {
  validateImage(image);
  const endpoint = process.env.EAISER_API_URL;
  if (!endpoint) throw new EaiserError("provider_not_configured", "EAiSER is not configured.", 503);

  const form = new FormData();
  form.append(process.env.EAISER_IMAGE_FIELD || "image", new Blob([await image.arrayBuffer()], { type: image.type || "application/octet-stream" }), image.name || "campus-image");
  form.append(process.env.EAISER_CONTEXT_FIELD || "context", JSON.stringify({
    campusId,
    regionId,
    buildingId,
    latitude: numberOrNull(latitude),
    longitude: numberOrNull(longitude),
  }));

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: process.env.EAISER_API_KEY ? { Authorization: `Bearer ${process.env.EAISER_API_KEY}` } : undefined,
      body: form,
      signal,
    });
  } catch (error) {
    throw new EaiserError("provider_unreachable", "EAiSER could not be reached.", 502, { cause: error.message });
  }

  if (response.status === 401 || response.status === 403) {
    throw new EaiserError("provider_authentication", "EAiSER authentication failed.", 502);
  }
  if (response.status === 408 || response.status === 429) {
    throw new EaiserError("provider_quota_or_timeout", "EAiSER is busy or rate-limited.", 503);
  }
  if (!response.ok) {
    throw new EaiserError("provider_error", `EAiSER returned HTTP ${response.status}.`, 502);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new EaiserError("provider_invalid_response", "EAiSER returned invalid JSON.", 502);
  }
  return normalizeProviderResponse(payload);
}

export function analysisErrorResponse(error) {
  const known = error instanceof EaiserError;
  return {
    status: known ? error.status : 500,
    body: {
      error: {
        code: known ? error.code : "analysis_failed",
        message: known ? error.message : "Image analysis failed.",
        details: known ? error.details : {},
      },
    },
  };
}
