"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchDashboardProjects } from "@/lib/dashboards-api";
import { fetchOrganizations } from "@/lib/crm-api";
import { readActiveProjectSelection } from "@/lib/project-session";
import type { OrganizationRow } from "@/types/phase2";
import type { MeetingBriefRow } from "@/types/phase4";

function buildLegislativeTemplate(input: {
  projectName: string;
  estimatedMgd?: number | null;
  revenue?: number | null;
  organizationName?: string | null;
}): string {
  const mgdLine = input.estimatedMgd != null ? `Estimated demand: ${input.estimatedMgd} MGD.` : "Estimated demand: (TBD).";
  const revenueLine = input.revenue != null ? `Projected revenue: $${input.revenue}.` : "Projected revenue: (TBD).";
  const orgLine = input.organizationName ? `Primary stakeholder: ${input.organizationName}.` : "Primary stakeholder: (TBD).";

  return [
    `LEGISLATIVE BRIEF — ${input.projectName}`,
    "",
    "Purpose:",
    "- Summarize the project’s value, urgency, and next actions for policymakers.",
    "",
    "What it is:",
    "- (Describe the project in 1–2 sentences.)",
    "",
    "Why it matters:",
    `- ${mgdLine}`,
    `- ${revenueLine}`,
    `- ${orgLine}`,
    "",
    "Current status:",
    "- (idea / active / permitting / construction / etc.)",
    "",
    "Request / next step:",
    "- (What decision, funding, or permitting support is needed?)",
  ].join("\n");
}

export function LegislativeBriefsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const [projects, setProjects] = useState<Awaited<ReturnType<typeof fetchDashboardProjects>>>([]);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);

  const [projectId, setProjectId] = useState<string>("");
  const [organizationId, setOrganizationId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [briefText, setBriefText] = useState<string>("");

  const [savedBriefs, setSavedBriefs] = useState<MeetingBriefRow[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");

  async function reload() {
    setIsBusy(true);
    try {
      const [p, o] = await Promise.all([fetchDashboardProjects(supabase), fetchOrganizations(supabase, activeProjectId || undefined)]);
      setProjects(p);
      setOrganizations(o);

      const { data: briefs, error: briefsError } = await supabase
        .from("meeting_briefs")
        .select("*")
        .eq("audience", "legislative")
        .order("updated_at", { ascending: false })
        .limit(25);

      if (briefsError) {
        // Phase 4 tables may not exist yet; keep page usable.
        setSavedBriefs([]);
      } else {
        setSavedBriefs((briefs ?? []) as MeetingBriefRow[]);
      }

      setStatusMessage("Loaded legislative briefs.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Load failed: ${message}. Did you run supabase/phase2.sql?`);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    const selected = readActiveProjectSelection();
    setActiveProjectId(selected?.id ?? "");
    if (selected?.id) {
      setProjectId(selected.id);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId]);
  const selectedOrg = useMemo(() => organizations.find((o) => o.id === organizationId) ?? null, [organizations, organizationId]);

  function handleGenerate() {
    if (!selectedProject) {
      setStatusMessage("Select a project first.");
      return;
    }

    const nextTitle = title.trim() ? title : `${selectedProject.name} — Legislative Brief`;
    setTitle(nextTitle);

    const nextText = buildLegislativeTemplate({
      projectName: selectedProject.name,
      estimatedMgd: selectedProject.estimated_mgd,
      revenue: selectedProject.revenue,
      organizationName: selectedOrg?.name ?? null,
    });

    setBriefText(nextText);
    setStatusMessage("Draft generated.");
  }

  async function handleSave() {
    if (!briefText.trim()) {
      setStatusMessage("Brief text is required.");
      return;
    }

    setIsBusy(true);
    try {
      const { error } = await supabase.from("meeting_briefs").insert({
        project_id: projectId || null,
        organization_id: organizationId || null,
        audience: "legislative",
        title: title.trim() ? title.trim() : "Legislative Brief",
        brief_text: briefText,
      });

      if (error) throw new Error(error.message);

      await reload();
      setStatusMessage("Brief saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Save failed: ${message}. Did you run supabase/phase4.sql?`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Legislative Briefs</h2>
          <p className="mt-1 text-xs text-slate-300">Draft and store policy-ready briefs (Phase 4 table: meeting_briefs).</p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={isBusy}
          className="rounded-md border border-slate-600 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-slate-100 disabled:opacity-50"
        >
          {isBusy ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-200">Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
            <option value="">(choose)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-200">Organization (optional)</label>
          <select
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">(none)</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-200">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Legislative Brief title" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        </div>

        <div className="md:col-span-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isBusy}
            className="rounded-md border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
          >
            Generate Draft
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isBusy}
            className="rounded-md border border-slate-600 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50"
          >
            Save Brief
          </button>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-200">Brief Text</label>
          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            className="mt-1 h-64 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Write or generate a legislative brief..."
          />
        </div>
      </div>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Recent Saved Briefs</p>
        <div className="mt-3 space-y-2">
          {savedBriefs.length === 0 ? (
            <p className="text-xs text-slate-300">No saved briefs yet (or `meeting_briefs` not created).</p>
          ) : (
            savedBriefs.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setProjectId(b.project_id ?? "");
                  setOrganizationId(b.organization_id ?? "");
                  setTitle(b.title);
                  setBriefText(b.brief_text);
                  setStatusMessage("Loaded saved brief into editor.");
                }}
                className="w-full rounded border border-slate-700 bg-slate-950/40 px-3 py-2 text-left hover:bg-slate-950/60"
              >
                <p className="truncate text-sm font-semibold text-slate-100">{b.title}</p>
                <p className="text-xs text-slate-400">Updated: {new Date(b.updated_at).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{statusMessage}</p>
      ) : null}
    </div>
  );
}
