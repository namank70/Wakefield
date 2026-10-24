import { suggestDuplicate } from "@/lib/server/wakefield";

export async function POST(request: Request) {
  try {
    const result = suggestDuplicate(await request.json());
    return result ? Response.json(result) : new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: { message: error instanceof Error ? error.message : "Duplicate search failed" } }, { status: 400 });
  }
}
