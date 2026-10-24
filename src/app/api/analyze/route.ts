import { analyzePhoto } from "@/lib/server/wakefield";
import { analyzeImage, VisionError } from "@/lib/server/vision";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: { message: "Use the Wakefield app to analyze a photo." } }, { status: 403 });
    if (Number(request.headers.get("content-length")) > 10 * 1024 * 1024 + 65536) return Response.json({ error: { message: "Photo exceeds the 10 MB limit." } }, { status: 413 });
    const form = await request.formData();
    const coordinate = (name: string) => { const raw = form.get(name); return raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : undefined; };
    const context = { campusId: String(form.get("campusId") || "sjsu"), latitude: coordinate("latitude"), longitude: coordinate("longitude"), regionId: String(form.get("regionId") || "") || undefined, buildingId: String(form.get("buildingId") || "") || undefined };
    const image = form.get("image");
    if (image instanceof Blob) return Response.json(await analyzeImage(image, context), { headers: { "Cache-Control": "no-store" } });
    const photoId = String(form.get("photoId") || "");
    if (!photoId) return Response.json({ error: { message: "photoId is required" } }, { status: 400 });
    return Response.json(await analyzePhoto(photoId, context));
  } catch (error) {
    return Response.json({ error: { message: error instanceof Error ? error.message : "Analysis failed" } }, { status: error instanceof VisionError ? error.status : 500 });
  }
}
