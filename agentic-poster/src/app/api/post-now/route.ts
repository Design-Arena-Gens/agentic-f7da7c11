import { NextResponse } from "next/server";
import { publishToLinkedIn } from "@/lib/linkedin";
import { updateScheduledPostStatus } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const content = body?.content;
    const id = body?.id;
    if (!content || typeof content !== "string") {
      return NextResponse.json({ success: false, error: "Missing content" }, { status: 400 });
    }

    const publishResult = await publishToLinkedIn({ content });

    if (id && typeof id === "string") {
      await updateScheduledPostStatus(id, "posted", {
        content,
        linkedinUrn: publishResult.urn,
        metrics: {
          publishedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ success: true, result: publishResult });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
