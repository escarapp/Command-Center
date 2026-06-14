"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { countByPriority, countByStatus, fetchDashboardProjects } from "@/lib/dashboards-api";

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function ProjectPerformancePage() {
  const supabase = useMemo(() => createClient(), []);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof fetchDashboardProjects>>>([]);

  async function reload() {
    setIsBusy(true);
    try {
      const next = await fetchDashboardProjects(supabase);
      setProjects(next);
      setStatusMessage("Loaded project performance.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Load failed: ${message}. Did you run supabase/phase2.sql?`);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusCounts = useMemo(() => countByStatus(projects), [projects]);
  const priorityCounts = useMemo(() => countByPriority(projects), [projects]);

  const sortedStatuses = useMemo(() => {
    const entries = Object.entries(statusCounts);
    entries.sort((a, b) => b[1] - a[1]);
    return entries;
  }, [statusCounts]);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Project Performance</h2>
          <p className="mt-1 text-xs text-slate-300">Quick health view: counts by status + priority, plus recently updated projects.</p>
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

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">By Status</p>
          <div className="mt-3 space-y-2">
            {sortedStatuses.length === 0 ? (
              <p className="text-xs text-slate-300">No projects yet.</p>
            ) : (
              sortedStatuses.map(([status, count]) => (
                <div key={status} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-950/40 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-100">{status}</p>
                  <p className="text-xs font-semibold text-slate-200">{formatNumber(count)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">By Priority</p>
          <div className="mt-3 space-y-2">
            {(Object.entries(priorityCounts) as Array<[keyof typeof priorityCounts, number]>).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-950/40 px-3 py-2">
                <p className="text-sm font-semibold text-slate-100">{priority}</p>
                <p className="text-xs font-semibold text-slate-200">{formatNumber(count)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Recently Updated</p>
        <div className="mt-3 space-y-2">
          {projects.length === 0 ? (
            <p className="text-xs text-slate-300">No projects yet.</p>
          ) : (
            projects.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-950/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">{p.name}</p>
                  <p className="text-xs text-slate-400">Status: {p.status} · Priority: {p.priority}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-300">{new Date(p.updated_at).toLocaleString()}</p>
              </div>
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
