// The integrated app uses its same-origin Next.js API by default. Set
// NEXT_PUBLIC_DATA_MODE=mock selects the self-contained local data adapter.
export const dataMode = process.env.NEXT_PUBLIC_DATA_MODE === "mock" ? "mock" : "live";
export const guidedMode = process.env.NEXT_PUBLIC_GUIDED_MODE === "true"
  || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
