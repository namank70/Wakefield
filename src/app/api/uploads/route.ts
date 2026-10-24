import { uploadPhoto } from "@/lib/server/wakefield";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const image = form.get("image");
      if (!(image instanceof Blob)) return Response.json({ error: { message: "image is required" } }, { status: 400 });
      return Response.json(await uploadPhoto(image, String(form.get("campusId") || "sjsu")));
    }
    const body = await request.json().catch(() => ({}));
    return Response.json({ photoId: `photo-pending-${crypto.randomUUID()}`, imagePath: `pending/${body.campusId || "sjsu"}`, storage: "session" });
  } catch (error) {
    return Response.json({ error: { message: error instanceof Error ? error.message : "Upload failed" } }, { status: 500 });
  }
}
