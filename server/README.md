# EAiSER server boundary

`eaiser-adapter.mjs` is the provider-facing implementation for Wakefield's
internal `POST /api/analyze` contract. It validates the image, keeps credentials
server-side, sends multipart form data to EAiSER, normalizes the provider
response, and returns structured errors.

The repository does not yet contain the team's HTTP framework or backend route.
The backend owner should call `analyzeWithEaiser()` from their `/api/analyze`
handler and use `analysisErrorResponse()` for failures.

Required environment values:

```text
EAISER_API_URL=https://...
EAISER_API_KEY=...
EAISER_IMAGE_FIELD=image
EAISER_CONTEXT_FIELD=context
EAISER_MAX_IMAGE_BYTES=10485760
```

The first two values and any provider-specific field names must come from the
Momntum/EAiSER team; no credentials belong in the browser.
