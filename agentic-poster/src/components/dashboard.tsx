"use client";

import { useMemo, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import {
  saveIdeaAction,
  savePillarAction,
  saveProfileAction,
  saveScheduleAction,
  saveTemplateAction,
  deletePillarAction,
  deleteTemplateAction,
  deleteIdeaAction,
  updateScheduleStatusAction,
} from "@/app/actions";
import type { DashboardSnapshot, PostingWindow } from "@/lib/db";

type Props = {
  snapshot: DashboardSnapshot;
};

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  try {
    return format(parseISO(value), "EEE, dd MMM yyyy · HH:mm");
  } catch {
    return value;
  }
}

export default function Dashboard({ snapshot }: Props) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [postingWindows, setPostingWindows] = useState<PostingWindow[]>(
    snapshot.profile?.postingWindows.length ? snapshot.profile.postingWindows : [{ day: "Monday", time: "09:00" }],
  );
  const [draftContent, setDraftContent] = useState("");
  const [draftScheduledDate, setDraftScheduledDate] = useState("");
  const [draftPillarId, setDraftPillarId] = useState(snapshot.pillars[0]?.id ?? "");
  const [draftTemplateId, setDraftTemplateId] = useState(snapshot.templates[0]?.id ?? "");
  const [draftAudience, setDraftAudience] = useState(snapshot.profile?.targetAudience ?? "");
  const [draftIdeaHook, setDraftIdeaHook] = useState("");
  const [generating, setGenerating] = useState(false);
  const [triggeringRun, setTriggeringRun] = useState(false);

  const upcoming = useMemo(
    () => snapshot.scheduled.filter((item) => item.status !== "posted"),
    [snapshot.scheduled],
  );

  const posted = useMemo(
    () => snapshot.scheduled.filter((item) => item.status === "posted").slice(0, 6),
    [snapshot.scheduled],
  );

  function handlePostingWindowChange(index: number, field: "day" | "time", value: string) {
    setPostingWindows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addPostingWindow() {
    setPostingWindows((prev) => [...prev, { day: "Monday", time: "09:00" }]);
  }

  function removePostingWindow(index: number) {
    setPostingWindows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== index) : prev));
  }

  async function handleProfileSubmit(formData: FormData) {
    formData.set("postingWindows", JSON.stringify(postingWindows));
    const result = await saveProfileAction(formData);
    setMessage(result.success ? "Profile saved." : result.error ?? "Unable to save profile.");
  }

  async function handleGenerateDraft() {
    if (!draftPillarId && !snapshot.profile) {
      setMessage("Configure your profile and pillars first.");
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pillarId: draftPillarId || undefined,
          templateId: draftTemplateId || undefined,
          audience: draftAudience || undefined,
          ideaHook: draftIdeaHook || undefined,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error ?? "Unknown error generating copy.");
      }
      setDraftContent(data.content);
      setMessage("Draft generated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to generate draft.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleScheduleSubmit(formData: FormData) {
    formData.set("pillarId", draftPillarId);
    formData.set("templateId", draftTemplateId);
    formData.set("content", draftContent);
    formData.set("audience", draftAudience);
    const result = await saveScheduleAction(formData);
    setMessage(result.success ? "Content scheduled." : result.error ?? "Failed to schedule content.");
  }

  async function handleSimpleAction(action: (data: FormData) => Promise<{ success: boolean; error?: string }>, id: string, extra?: Record<string, string>) {
    const formData = new FormData();
    formData.set("id", id);
    if (extra) {
      Object.entries(extra).forEach(([key, value]) => formData.set(key, value));
    }
    const result = await action(formData);
    setMessage(result.success ? "Saved." : result.error ?? "Request failed.");
  }

  async function handlePostNow(id: string, content: string) {
    try {
      const response = await fetch("/api/post-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error ?? "Posting failed.");
      }
      setMessage("Post published to LinkedIn.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Post request failed.");
    }
  }

  async function triggerAgentRun(dryRun = false) {
    setTriggeringRun(true);
    try {
      const response = await fetch("/api/run-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error ?? "Automation failed.");
      }
      setMessage(
        dryRun
          ? `Dry-run completed (${data.processed?.length ?? 0} items processed).`
          : `Agent executed (${data.processed?.length ?? 0} posts published).`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not trigger run.");
    } finally {
      setTriggeringRun(false);
    }
  }

  return (
    <main>
      <section className="app-header">
        <div>
          <h1>{snapshot.profile?.brandName || "LinkedIn Influence Agent"}</h1>
          <p>
            Operate an autonomous LinkedIn content engine that keeps you visible, authoritative, and consistent. Configure
            your voice, schedule, pillars, and automations—then let the agent handle creation and publishing.
          </p>
        </div>
        <div className="panel" style={{ minWidth: "260px" }}>
          <header>
            <h2>Integrations</h2>
          </header>
          <div className="list-stack">
            <div className="flex space-between center">
              <span>LinkedIn API</span>
              <span className={`badge ${snapshot.env.hasLinkedInToken ? "success" : "warning"}`}>
                {snapshot.env.hasLinkedInToken ? "Connected" : "Missing"}
              </span>
            </div>
            <div className="flex space-between center">
              <span>OpenAI</span>
              <span className={`badge ${snapshot.env.hasOpenAIKey ? "success" : "warning"}`}>
                {snapshot.env.hasOpenAIKey ? "Ready" : "Missing"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Scheduled</span>
          <span className="stat-value">{snapshot.stats.scheduledCount}</span>
          <span className="stat-meta">Posts queued for publishing</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Autopilot</span>
          <span className="stat-value">{snapshot.stats.autopilotCount}</span>
          <span className="stat-meta">Will auto-create & publish</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Published</span>
          <span className="stat-value">{snapshot.stats.postedCount}</span>
          <span className="stat-meta">Published via the agent</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Failures</span>
          <span className="stat-value">{snapshot.stats.failedCount}</span>
          <span className="stat-meta">Need manual review</span>
        </div>
      </section>

      {message && (
        <div className="panel wide" style={{ borderStyle: "dashed" }}>
          <div className="flex space-between center">
            <span>{message}</span>
            <button className="btn secondary small" onClick={() => setMessage(null)} type="button">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <section className="dashboard-grid">
        <article className="panel tall">
          <header>
            <div>
              <h2>Agent Profile</h2>
              <p>Define how the agent speaks, who it targets, and when it should publish on your behalf.</p>
            </div>
          </header>
          <form
            action={(formData) => {
              startTransition(() => {
                void handleProfileSubmit(formData);
              });
            }}
          >
            <div className="input-stack">
              <div className="input-field">
                <label>Brand / Expert Name</label>
                <input name="brandName" defaultValue={snapshot.profile?.brandName ?? ""} placeholder="e.g. Jane Doe, AI Strategy" required />
              </div>
              <div className="input-field">
                <label>LinkedIn Profile URL</label>
                <input
                  name="linkedinUrl"
                  defaultValue={snapshot.profile?.linkedinUrl ?? ""}
                  placeholder="https://www.linkedin.com/in/username/"
                />
              </div>
            </div>
            <div className="input-stack">
              <div className="input-field">
                <label>Voice & Positioning</label>
                <textarea
                  name="voice"
                  defaultValue={snapshot.profile?.voice ?? ""}
                  placeholder="Define your tone, point of view, and style guidelines."
                />
              </div>
              <div className="input-field">
                <label>Target Audience</label>
                <textarea
                  name="targetAudience"
                  defaultValue={snapshot.profile?.targetAudience ?? ""}
                  placeholder="Describe your ideal reader, their challenges, and what resonates."
                />
              </div>
              <div className="input-field">
                <label>Platform Goals</label>
                <textarea
                  name="goals"
                  defaultValue={snapshot.profile?.goals ?? ""}
                  placeholder="e.g. Become a Top Voice in AI Transformation, drive workshop leads, grow newsletter."
                />
              </div>
            </div>
            <div className="flex">
              <div className="input-field" style={{ minWidth: "220px" }}>
                <label>Cadence / week</label>
                <input
                  name="cadencePerWeek"
                  type="number"
                  min={1}
                  max={21}
                  defaultValue={snapshot.profile?.cadencePerWeek ?? 3}
                />
              </div>
            </div>
            <div className="input-stack">
              <label>Posting Windows</label>
              <div className="pill-grid">
                {postingWindows.map((window, index) => (
                  <div key={`${window.day}-${index}`} className="pill-row">
                    <header>
                      <span>
                        <strong>{window.day}</strong> · {window.time}
                      </span>
                      <div className="panel-actions">
                        <select
                          value={window.day}
                          onChange={(event) => handlePostingWindowChange(index, "day", event.target.value)}
                        >
                          {daysOfWeek.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={window.time}
                          onChange={(event) => handlePostingWindowChange(index, "time", event.target.value)}
                        />
                        <button type="button" className="btn secondary small" onClick={() => removePostingWindow(index)}>
                          Remove
                        </button>
                      </div>
                    </header>
                  </div>
                ))}
              </div>
              <button type="button" className="btn secondary small" onClick={addPostingWindow}>
                Add Posting Window
              </button>
            </div>
            <button className="btn" type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Agent Profile"}
            </button>
          </form>
        </article>

        <article className="panel compact">
          <header>
            <div>
              <h2>Run Automation</h2>
              <p>Kick off the autonomous agent or simulate the next cycle.</p>
            </div>
          </header>
          <div className="list-stack">
            <button className="btn" type="button" onClick={() => void triggerAgentRun(false)} disabled={triggeringRun}>
              {triggeringRun ? "Running..." : "Run Agent Now"}
            </button>
            <button className="btn secondary" type="button" onClick={() => void triggerAgentRun(true)} disabled={triggeringRun}>
              {triggeringRun ? "Simulating..." : "Dry Run (generate only)"}
            </button>
          </div>
          <div className="divider" />
          <div className="list-stack">
            <h3>Vercel Cron</h3>
            <p style={{ color: "var(--foreground-muted)", lineHeight: 1.5 }}>
              Add a scheduled trigger to keep the agent publishing. Example cron expression to run weekdays at 09:00:
            </p>
            <pre className="code-block">{'vercel cron add "Weekday 9AM" "0 9 * * 1-5" /api/run-agent'}</pre>
            <p style={{ color: "var(--foreground-muted)" }}>
              Use <code className="code-block" style={{ display: "inline" }}>vercel env pull</code> to sync environment values locally.
            </p>
          </div>
        </article>

        <article className="panel medium">
          <header>
            <div>
              <h2>Content Pillars</h2>
              <p>Define the authority lanes that your agent should reinforce across LinkedIn.</p>
            </div>
          </header>
          <form
            action={(formData) => {
              startTransition(() => {
                void savePillarAction(formData).then((result) =>
                  setMessage(result.success ? "Pillar saved." : result.error ?? "Unable to save pillar."),
                );
              });
            }}
          >
            <div className="input-stack">
              <div className="input-field">
                <label>Title</label>
                <input name="title" placeholder="e.g. Enterprise AI Roadmaps" required />
              </div>
              <div className="input-field">
                <label>Description</label>
                <textarea name="description" placeholder="Outline what the pillar covers and what outcomes it drives." />
              </div>
              <div className="input-field">
                <label>Audience focus</label>
                <input name="audience" placeholder="Who is this pillar speaking to?" />
              </div>
            </div>
            <input type="hidden" name="active" value="true" />
            <button className="btn secondary" type="submit" disabled={isPending}>
              Add Pillar
            </button>
          </form>
          <div className="scrollable">
            <div className="pill-grid">
              {snapshot.pillars.length === 0 && <div className="empty">No pillars yet. Create one to guide the agent.</div>}
              {snapshot.pillars.map((pillar) => (
                <div className="pill-row" key={pillar.id}>
                  <header>
                    <div>
                      <h3>{pillar.title}</h3>
                      <p>{pillar.description || "No description provided."}</p>
                    </div>
                    <span className={`badge ${pillar.active ? "success" : "warning"}`}>
                      {pillar.active ? "Active" : "Paused"}
                    </span>
                  </header>
                  <footer className="flex space-between">
                    <small>Audience: {pillar.audience || "General LinkedIn audience"}</small>
                    <div className="panel-actions">
                      <button
                        className="btn secondary small"
                        type="button"
                        onClick={() =>
                          startTransition(() =>
                            handleSimpleAction(savePillarAction, pillar.id, {
                              title: pillar.title,
                              description: pillar.description,
                              audience: pillar.audience,
                              active: pillar.active ? "false" : "true",
                            }),
                          )
                        }
                      >
                        {pillar.active ? "Pause" : "Activate"}
                      </button>
                      <button
                        className="btn danger small"
                        type="button"
                        onClick={() => startTransition(() => handleSimpleAction(deletePillarAction, pillar.id))}
                      >
                        Delete
                      </button>
                    </div>
                  </footer>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel medium">
          <header>
            <div>
              <h2>Templates & Prompts</h2>
              <p>Craft repeatable structures to ensure every post lands with clarity.</p>
            </div>
          </header>
          <form
            action={(formData) => {
              startTransition(() => {
                void saveTemplateAction(formData).then((result) =>
                  setMessage(result.success ? "Template saved." : result.error ?? "Unable to save template."),
                );
              });
            }}
          >
            <div className="input-stack">
              <div className="input-field">
                <label>Template title</label>
                <input name="title" placeholder="e.g. Transformation Story" required />
              </div>
              <div className="input-field">
                <label>Structure / Outline</label>
                <textarea
                  name="structure"
                  placeholder="Hook · Challenge · Insight · Call to action"
                  rows={2}
                />
              </div>
              <div className="input-field">
                <label>Prompt</label>
                <textarea
                  name="prompt"
                  placeholder="Ask the agent to focus on a transformation story and invite discussion."
                  required
                />
              </div>
              <div className="input-field">
                <label>Default call to action</label>
                <input name="callToAction" placeholder="e.g. Ask for opinions, direct to resource, invite DM." />
              </div>
            </div>
            <button className="btn secondary" type="submit" disabled={isPending}>
              Save Template
            </button>
          </form>
          <div className="scrollable">
            <div className="list-stack">
              {snapshot.templates.length === 0 && <div className="empty">Create templates to standardise outputs.</div>}
              {snapshot.templates.map((template) => (
                <div className="list-row" key={template.id}>
                  <header>
                    <div>
                      <h3>{template.title}</h3>
                      <p>{template.structure || "No explicit structure defined."}</p>
                    </div>
                    <button
                      className="btn danger small"
                      type="button"
                      onClick={() => startTransition(() => handleSimpleAction(deleteTemplateAction, template.id))}
                    >
                      Delete
                    </button>
                  </header>
                  <div>
                    <strong>Prompt</strong>
                    <p>{template.prompt}</p>
                  </div>
                  {template.callToAction && (
                    <div>
                      <strong>Call to action</strong>
                      <p>{template.callToAction}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel medium">
          <header>
            <div>
              <h2>Idea Backlog</h2>
              <p>Capture hooks, angles, and observations so the agent can transform them into posts.</p>
            </div>
          </header>
          <form
            action={(formData) => {
              startTransition(() => {
                void saveIdeaAction(formData).then((result) =>
                  setMessage(result.success ? "Idea captured." : result.error ?? "Unable to save idea."),
                );
              });
            }}
          >
            <div className="input-stack">
              <div className="input-field">
                <label>Idea summary</label>
                <textarea name="summary" placeholder="What do you want to talk about?" required />
              </div>
              <div className="flex">
                <div className="input-field" style={{ flex: 1 }}>
                  <label>Hook</label>
                  <input name="hook" placeholder="Optional punchy opening" />
                </div>
                <div className="input-field" style={{ flex: 1 }}>
                  <label>Angle</label>
                  <input name="angle" placeholder="Perspective or frame" />
                </div>
              </div>
              <div className="input-field">
                <label>Assign to pillar</label>
                <select name="pillarId" defaultValue="">
                  <option value="">No preference</option>
                  {snapshot.pillars.map((pillar) => (
                    <option key={pillar.id} value={pillar.id}>
                      {pillar.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn secondary" type="submit" disabled={isPending}>
              Add to Backlog
            </button>
          </form>
          <div className="scrollable">
            <div className="list-stack">
              {snapshot.backlog.length === 0 && <div className="empty">Keep a backlog of sparks ready for the agent.</div>}
              {snapshot.backlog.map((idea) => (
                <div className="list-row" key={idea.id}>
                  <header>
                    <div>
                      <h3>{idea.hook || idea.summary.slice(0, 60)}</h3>
                      <p>{idea.summary}</p>
                    </div>
                    <button
                      className="btn danger small"
                      type="button"
                      onClick={() => startTransition(() => handleSimpleAction(deleteIdeaAction, idea.id))}
                    >
                      Delete
                    </button>
                  </header>
                  <footer className="flex space-between">
                    <small>
                      Pillar:{" "}
                      {idea.pillarId ? snapshot.pillars.find((pillar) => pillar.id === idea.pillarId)?.title ?? "Unknown" : "Any"}
                    </small>
                    {idea.angle && <span className="tag">Angle: {idea.angle}</span>}
                  </footer>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel wide">
          <header>
            <div>
              <h2>Scheduling & Publishing</h2>
              <p>Generate posts, refine the copy, and queue them for automatic publication.</p>
            </div>
          </header>
          <form
            action={(formData) => {
              startTransition(() => {
                void handleScheduleSubmit(formData);
              });
            }}
          >
            <div className="flex">
              <div className="input-field" style={{ minWidth: "220px" }}>
                <label>Content pillar</label>
                <select value={draftPillarId} onChange={(event) => setDraftPillarId(event.target.value)} name="pillarId">
                  {snapshot.pillars.length === 0 && <option value="">Create a pillar first</option>}
                  {snapshot.pillars.map((pillar) => (
                    <option key={pillar.id} value={pillar.id}>
                      {pillar.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-field" style={{ minWidth: "220px" }}>
                <label>Template</label>
                <select value={draftTemplateId} onChange={(event) => setDraftTemplateId(event.target.value)} name="templateId">
                  {snapshot.templates.length === 0 && <option value="">Add a template first</option>}
                  {snapshot.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-field" style={{ minWidth: "220px" }}>
                <label>Audience override</label>
                <input value={draftAudience} onChange={(event) => setDraftAudience(event.target.value)} placeholder="Optional" />
              </div>
              <div className="input-field" style={{ minWidth: "220px" }}>
                <label>Scheduled for</label>
                <input
                  type="datetime-local"
                  name="scheduledFor"
                  value={draftScheduledDate}
                  onChange={(event) => setDraftScheduledDate(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="input-field">
              <label>Idea hook / angle</label>
              <input value={draftIdeaHook} onChange={(event) => setDraftIdeaHook(event.target.value)} placeholder="Optional: strong hook or angle" />
            </div>
            <div className="input-field">
              <label>Draft content</label>
              <textarea
                name="content"
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                placeholder="Generate or paste your LinkedIn copy here."
                rows={6}
              />
            </div>
            <div className="panel-actions">
              <input type="hidden" name="status" value="scheduled" />
              <label className="flex center" style={{ gap: "0.5rem" }}>
                <input type="checkbox" name="autopilot" defaultChecked />
                Autopilot (agent will publish)
              </label>
              <button type="button" className="btn secondary small" onClick={() => void handleGenerateDraft()} disabled={generating}>
                {generating ? "Generating..." : "Generate copy"}
              </button>
              <button className="btn" type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Queue Post"}
              </button>
            </div>
          </form>
          <div className="status-grid">
            {upcoming.length === 0 && <div className="empty">No upcoming posts. Schedule something to stay top of mind.</div>}
            {upcoming.map((post) => (
              <div className="status-row" key={post.id}>
                <header>
                  <div>
                    <h3>{snapshot.pillars.find((pillar) => pillar.id === post.pillarId)?.title ?? "Unassigned Pillar"}</h3>
                    <span className="chip" data-status={post.status}>
                      {post.status}
                    </span>
                  </div>
                  <div className="panel-actions">
                    <button className="btn secondary small" type="button" onClick={() => setDraftContent(post.content)}>
                      Load into editor
                    </button>
                    <button className="btn small" type="button" onClick={() => void handlePostNow(post.id, post.content)}>
                      Post now
                    </button>
                    <button
                      className="btn danger small"
                      type="button"
                      onClick={() =>
                        startTransition(() =>
                          handleSimpleAction(updateScheduleStatusAction, post.id, { status: "cancelled" }),
                        )
                      }
                    >
                      Cancel
                    </button>
                  </div>
                </header>
                <p>{post.content || "Content will be generated automatically."}</p>
                <footer>
                  <small>{formatDate(post.scheduledFor)}</small>
                  <span className={`badge ${post.autopilot ? "success" : "warning"}`}>
                    {post.autopilot ? "Autopilot enabled" : "Manual publish"}
                  </span>
                </footer>
                {post.error && (
                  <div className="badge danger" style={{ alignSelf: "flex-start" }}>
                    Last error: {post.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="panel medium">
          <header>
            <div>
              <h2>Recent Activity</h2>
              <p>Monitor what the agent posted and track delivery status.</p>
            </div>
          </header>
          <div className="timeline">
            {posted.length === 0 && <div className="empty">No posts published yet.</div>}
            {posted.map((post) => (
              <div key={post.id} className="timeline-item">
                <strong>{snapshot.pillars.find((pillar) => pillar.id === post.pillarId)?.title ?? "Unknown pillar"}</strong>
                <p style={{ color: "var(--foreground-muted)" }}>{post.content.slice(0, 200)}...</p>
                <div className="flex space-between center" style={{ marginTop: "0.5rem" }}>
                  <small>{formatDate(post.scheduledFor)}</small>
                  {post.linkedinUrn ? <span className="tag">URN: {post.linkedinUrn}</span> : <span className="tag">Published</span>}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
