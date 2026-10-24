import { issueDetail } from "@/lib/server/wakefield";

export async function GET(_request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    return Response.json(issueDetail((await params).issueId));
  } catch (error) {
    return Response.json({ error: { message: error instanceof Error ? error.message : "Issue not found" } }, { status: 404 });
  }
}
