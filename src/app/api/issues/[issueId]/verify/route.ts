import { verifyIssue } from "@/lib/server/wakefield";

export async function POST(request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    return Response.json(verifyIssue((await params).issueId, await request.json()));
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return Response.json({ error: { message: error instanceof Error ? error.message : "Verification failed" } }, { status });
  }
}
