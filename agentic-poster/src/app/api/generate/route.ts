import { NextResponse } from "next/server";
import { generateLinkedInPost } from "@/lib/openai";
import { getPillarById, getTemplateById, getProfile } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json({ success: false, error: "Configure your agent profile first." }, { status: 400 });
    }

    const pillar = body?.pillarId ? await getPillarById(body.pillarId) : null;
    const template = body?.templateId ? await getTemplateById(body.templateId) : null;

    const content = await generateLinkedInPost({
      voice: profile.voice,
      audience: body?.audience ?? profile.targetAudience,
      goals: profile.goals,
      pillarTitle: pillar?.title,
      pillarDescription: pillar?.description,
      templateStructure: template?.structure,
      templatePrompt: template?.prompt,
      ideaHook: body?.ideaHook,
      ideaAngle: body?.ideaAngle,
    });

    return NextResponse.json({ success: true, content });
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
