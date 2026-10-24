import { analyzePhoto } from "@/lib/server/wakefield";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const photoId = String(form.get("photoId") || "");
    if (!photoId) return Response.json({ error: { message: "photoId is required" } }, { status: 400 });
    return Response.json(await analyzePhoto(photoId, { campusId: String(form.get("campusId") || "sjsu"), latitude: Number(form.get("latitude")), longitude: Number(form.get("longitude")), regionId: String(form.get("regionId") || "") || undefined, buildingId: String(form.get("buildingId") || "") || undefined }));
  } catch (error) {
    return Response.json({ error: { message: error instanceof Error ? error.message : "Analysis failed" } }, { status: 500 });
  }
}
