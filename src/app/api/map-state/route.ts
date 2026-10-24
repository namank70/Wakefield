import { mapState } from "@/lib/server/wakefield";

export async function GET() {
  return Response.json(mapState());
}
