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

`provider` must be one of `eaiser`, `cached`, or `mock` so the demo never misrepresents fallback output as live analysis.

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

Handle unsupported files, oversized images, unclear images, no recognizable issue, provider timeout, quota exhaustion, and authentication failure with structured errors. Keep successful normalized responses cached for the five demo scenarios defined in the work plan.

## Environment boundary

EAiSER credentials stay server-side. The browser calls Wakefield's `/api/analyze` endpoint; it never calls EAiSER directly.

## Implementation status

The server-side provider adapter now lives in `server/eaiser-adapter.mjs`.
It validates uploads, sends multipart requests, normalizes provider responses,
and exposes structured error data for the backend route. The Studio preview
calls `/api/analyze` first and only uses its deterministic fallback when the
Studio sandbox has no Wakefield API route.

The remaining final-integration inputs are provider configuration values, not
application behavior: the real EAiSER URL, credential, and any confirmed
native field names.

## Before production activation

Confirm with the Momntum team:

1. Image submission method and authentication
2. Required format and maximum size
3. Whether campus context can accompany the image
4. Available classifications and fields
5. Rate limits, quota, and latency
6. Development versus demo credentials

Do not invent the native EAiSER request shape until those answers are confirmed.
