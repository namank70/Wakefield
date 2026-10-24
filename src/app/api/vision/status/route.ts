import { getVisionStatus } from "@/lib/server/vision";

export async function GET(request: Request) {
  // Access runtime request data so this status is never frozen during a build.
  void request.url;
  return Response.json(await getVisionStatus(), { headers: { "Cache-Control": "no-store" } });
}
