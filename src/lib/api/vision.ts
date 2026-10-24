import type { AnalysisResult, AnalyzePhotoInput } from "@/lib/types";

export type VisionStatus = { ready: boolean; provider: string; model: string | null; message: string };

export async function analyzePhotoImage(image: Blob, context?: Partial<AnalyzePhotoInput>): Promise<AnalysisResult> {
  const body = new FormData();
  body.set("image", image, "campus-photo.jpg");
  body.set("campusId", context?.campusId || "sjsu");
  const response = await fetch("/api/analyze", { method: "POST", body, signal: AbortSignal.timeout(310_000) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "Photo AI could not finish. Retry or use manual review.");
  return payload as AnalysisResult;
}

export async function fetchVisionStatus(): Promise<VisionStatus> {
  const response = await fetch("/api/vision/status", { cache: "no-store", signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error("Photo AI status is unavailable.");
  return response.json();
}
