import { createReport } from "@/lib/server/wakefield";

export async function POST(request: Request) {
  try {
    return Response.json(createReport(await request.json()));
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return Response.json({ error: { message: error instanceof Error ? error.message : "Report creation failed" } }, { status });
  }
}
