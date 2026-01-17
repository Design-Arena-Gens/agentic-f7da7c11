"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AgentProfile,
  deleteIdea,
  deletePillar,
  deleteTemplate,
  upsertAgentProfile,
  upsertContentPillar,
  upsertIdea,
  upsertScheduledPost,
  upsertTemplate,
  updateScheduledPostStatus,
} from "@/lib/db";

const postingWindowSchema = z
  .array(
    z.object({
      day: z.string(),
      time: z.string(),
    }),
  )
  .default([]);

const profileSchema = z.object({
  brandName: z.string().min(2),
  linkedinUrl: z.string().optional(),
  voice: z.string().optional(),
  targetAudience: z.string().optional(),
  goals: z.string().optional(),
  cadencePerWeek: z.preprocess((value) => Number(value), z.number().min(1).max(21)),
  postingWindows: z.string().optional(),
});

export async function saveProfileAction(formData: FormData) {
  const parsed = profileSchema.safeParse({
    brandName: formData.get("brandName"),
    linkedinUrl: formData.get("linkedinUrl"),
    voice: formData.get("voice"),
    targetAudience: formData.get("targetAudience"),
    goals: formData.get("goals"),
    cadencePerWeek: formData.get("cadencePerWeek"),
    postingWindows: formData.get("postingWindows"),
  });

  if (!parsed.success) {
    return { success: false, error: "Invalid profile details" };
  }

  let postingWindows: AgentProfile["postingWindows"] = [];
  try {
    postingWindows = parsed.data.postingWindows
      ? postingWindowSchema.parse(JSON.parse(parsed.data.postingWindows))
      : [];
  } catch {
    postingWindows = [];
  }

  await upsertAgentProfile({
    brandName: parsed.data.brandName,
    linkedinUrl: parsed.data.linkedinUrl ?? "",
    voice: parsed.data.voice ?? "",
    targetAudience: parsed.data.targetAudience ?? "",
    goals: parsed.data.goals ?? "",
    cadencePerWeek: parsed.data.cadencePerWeek,
    postingWindows,
  });

  revalidatePath("/");
  return { success: true };
}

const pillarSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  audience: z.string().optional(),
  active: z.preprocess((value) => String(value) === "true", z.boolean()),
});

export async function savePillarAction(formData: FormData) {
  const parsed = pillarSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description"),
    audience: formData.get("audience"),
    active: formData.get("active") ?? "true",
  });
  if (!parsed.success) {
    return { success: false, error: "Invalid pillar data" };
  }

  await upsertContentPillar({
    id: parsed.data.id || randomUUID(),
    title: parsed.data.title,
    description: parsed.data.description ?? "",
    audience: parsed.data.audience ?? "",
    active: parsed.data.active,
  });

  revalidatePath("/");
  return { success: true };
}

export async function deletePillarAction(formData: FormData) {
  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    return { success: false, error: "Missing pillar id" };
  }
  await deletePillar(id);
  revalidatePath("/");
  return { success: true };
}

const templateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2),
  structure: z.string().optional(),
  prompt: z.string().min(5),
  callToAction: z.string().optional(),
});

export async function saveTemplateAction(formData: FormData) {
  const parsed = templateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    structure: formData.get("structure"),
    prompt: formData.get("prompt"),
    callToAction: formData.get("callToAction"),
  });
  if (!parsed.success) {
    return { success: false, error: "Invalid template data" };
  }

  await upsertTemplate({
    id: parsed.data.id || randomUUID(),
    title: parsed.data.title,
    structure: parsed.data.structure ?? "",
    prompt: parsed.data.prompt,
    callToAction: parsed.data.callToAction ?? "",
  });

  revalidatePath("/");
  return { success: true };
}

export async function deleteTemplateAction(formData: FormData) {
  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    return { success: false, error: "Missing template id" };
  }
  await deleteTemplate(id);
  revalidatePath("/");
  return { success: true };
}

const ideaSchema = z.object({
  id: z.string().optional(),
  pillarId: z.string().optional(),
  summary: z.string().min(5),
  hook: z.string().optional(),
  angle: z.string().optional(),
});

export async function saveIdeaAction(formData: FormData) {
  const parsed = ideaSchema.safeParse({
    id: formData.get("id"),
    pillarId: formData.get("pillarId"),
    summary: formData.get("summary"),
    hook: formData.get("hook"),
    angle: formData.get("angle"),
  });
  if (!parsed.success) {
    return { success: false, error: "Invalid idea" };
  }

  await upsertIdea({
    id: parsed.data.id || randomUUID(),
    pillarId: parsed.data.pillarId || null,
    summary: parsed.data.summary,
    hook: parsed.data.hook ?? null,
    angle: parsed.data.angle ?? null,
  });

  revalidatePath("/");
  return { success: true };
}

export async function deleteIdeaAction(formData: FormData) {
  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    return { success: false, error: "Missing idea id" };
  }
  await deleteIdea(id);
  revalidatePath("/");
  return { success: true };
}

const scheduleSchema = z.object({
  id: z.string().optional(),
  pillarId: z.string().optional(),
  templateId: z.string().optional(),
  content: z.string().optional(),
  audience: z.string().optional(),
  status: z.string().optional(),
  scheduledFor: z.string().optional(),
  autopilot: z
    .preprocess(
      (value) => value === "true" || value === "on" || value === "1" || value === true,
      z.boolean(),
    )
    .optional(),
});

export async function saveScheduleAction(formData: FormData) {
  const parsed = scheduleSchema.safeParse({
    id: formData.get("id"),
    pillarId: formData.get("pillarId"),
    templateId: formData.get("templateId"),
    content: formData.get("content"),
    audience: formData.get("audience"),
    status: formData.get("status") ?? "scheduled",
    scheduledFor: formData.get("scheduledFor"),
    autopilot: formData.get("autopilot") ?? "false",
  });
  if (!parsed.success) {
    return { success: false, error: "Invalid schedule" };
  }

  await upsertScheduledPost({
    id: parsed.data.id || randomUUID(),
    pillarId: parsed.data.pillarId || null,
    templateId: parsed.data.templateId || null,
    content: parsed.data.content ?? "",
    audience: parsed.data.audience ?? null,
    status: parsed.data.status ?? "scheduled",
    scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor).toISOString() : null,
    autopilot: parsed.data.autopilot ?? false,
    metrics: {},
    error: null,
    linkedinUrn: null,
  });

  revalidatePath("/");
  return { success: true };
}

export async function updateScheduleStatusAction(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (!id || typeof id !== "string" || !status || typeof status !== "string") {
    return { success: false, error: "Missing schedule id or status" };
  }
  await updateScheduledPostStatus(id, status);
  revalidatePath("/");
  return { success: true };
}
