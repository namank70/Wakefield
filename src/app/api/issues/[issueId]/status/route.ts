import type { IssueStatus } from "@/lib/types";
import { updateIssueStatus } from "@/lib/server/wakefield";

export async function PATCH(request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    const body = await request.json() as { status?: IssueStatus; note?: string };
    if (!body.status) return Response.json({ error: { message: "status is required" } }, { status: 400 });
    return Response.json(updateIssueStatus((await params).issueId, body.status, body.note));
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return Response.json({ error: { message: error instanceof Error ? error.message : "Status update failed" } }, { status });
  }
}
