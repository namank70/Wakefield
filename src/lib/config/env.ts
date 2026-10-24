export const dataMode = process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "mock";
export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
