# EAiSER Image Intelligence

This branch owns the image-analysis boundary for Wakefield. It converts one campus photo into a stable Wakefield analysis object. The frontend and backend must not depend on EAiSER's native field names.

## Branch

`feature/eaiser-image-intelligence`

## Internal endpoint

```http
POST /api/analyze
Content-Type: multipart/form-data
```

Inputs:

- `image` — required image file
- `latitude` — optional number
- `longitude` — optional number
- `campusId` — `sjsu`
- `regionId` — optional region hint
- `buildingId` — optional building hint

## Normalized response

```json
{
  "category": "bike_scooter_parking",
  "summary": "Bikes and scooters are blocking the pedestrian route",
  "severity": "high",
  "department": "Transportation and Parking Services",
  "confidence": 0.92,
  "accessibilityImpact": true,
  "tags": ["blocked-path", "bike", "scooter"],
  "provider": "eaiser"
}
```

`provider` must be one of `ollama`, `eaiser`, `cached`, or `mock` so the UI can distinguish local vision inference, an external result, saved labels and manual review.

## Bounded taxonomy

- `lighting`
- `walkway_obstruction`
- `trash_overflow`
- `bike_scooter_parking`
- `water_leak`
- `door_lock`
- `printer_technology`
- `accessibility_barrier`
- `other`

## Required fallback behavior

Handle unsupported files, oversized images, unclear images, no recognizable issue, provider timeout, quota exhaustion, and authentication failure with structured errors. Keep successful normalized responses cached for the prepared photo examples.

## Environment boundary

EAiSER credentials stay server-side. The browser calls Wakefield's `/api/analyze` endpoint; it never calls EAiSER directly.

## Current status

The EAiSER Studio image-analysis namespace and live report-submission method have not been confirmed. Earlier attempts to call `EAiSER.image.analyze(file)` failed at runtime because `EAiSER.image` was undefined. No Studio source file should call that guessed method or claim an EAiSER result until the actual Studio runtime exposes and successfully runs a supported method.

The Next.js application now uses the local Ollama vision adapter in `src/lib/server/vision.ts` by default. It sends actual photo bytes to a local model and validates structured suggestions. See `docs/LOCAL_AI.md`. `ANALYSIS_PROVIDER=manual` explicitly selects manual review; an unavailable model returns an error and a reporter may choose manual review. The separate EAiSER adapter still requires a confirmed `EAISER_API_URL`, authentication and response schema from Momntum. Neither local inference nor a saved report sends a message to campus staff.

## Before production activation

Confirm with the Momntum team:

1. Image submission method and authentication
2. Required format and maximum size
3. Whether campus context can accompany the image
4. Available classifications and fields
5. Rate limits, quota, and latency
6. Development versus production credentials

Do not invent the native EAiSER request shape until those answers are confirmed.
