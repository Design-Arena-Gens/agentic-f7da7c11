import { NextResponse } from "next/server";
import { runAgentOnce } from "@/lib/scheduler";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runAgentOnce({
      dryRun: Boolean(body?.dryRun),
      lookAheadMinutes: typeof body?.lookAheadMinutes === "number" ? body.lookAheadMinutes : 0,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
