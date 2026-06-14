"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeCapexTotalFromEstimate, fetchDashboardProjects, fetchLatestCostEstimatesByProject } from "@/lib/dashboards-api";

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string): string {
  return value
    .trim()
    .replaceAll(/\s+/g, "_")
    .replaceAll(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 160);
}

async function persistExportToSupabase(input: {
  supabase: ReturnType<typeof createClient>;
  exportType: string;
  fileName: string;
  contentType: string;
  content: string;
  params: Record<string, unknown>;
}): Promise<{ storagePath: string } | null> {
  // Storage bucket is created in Phase 3 SQL.
  // History table is created in Phase 4 SQL.
  const datePrefix = new Date().toISOString().slice(0, 10);
  const storagePath = `dashboards/${datePrefix}/${safeFilename(input.fileName)}`;

  const blob = new Blob([input.content], { type: input.contentType });

  const { error: uploadError } = await input.supabase.storage
    .from("planning_exports")
    .upload(storagePath, blob, { contentType: input.contentType, upsert: true });

  if (uploadError) {
    // If bucket/policies aren't installed yet, don't break exports.
    return null;
  }

  // Best-effort history insert.
  await input.supabase.from("export_history").insert({
    export_type: input.exportType,
    params: {
      ...input.params,
      storage_bucket: "planning_exports",
      storage_path: storagePath,
      content_type: input.contentType,
    },
    file_name: storagePath,
  });

  return { storagePath };
}

function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  const headers = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set()),
  );

  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    if (/[\n\r,\"]/g.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(","));
  }
  return lines.join("\n");
}

export function DashboardExportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const [executiveSummary, setExecutiveSummary] = useState<Record<string, unknown> | null>(null);
  const [investorRows, setInvestorRows] = useState<Array<Record<string, unknown>>>([]);

  async function reload() {
    setIsBusy(true);
    try {
      const projects = await fetchDashboardProjects(supabase);
      const estimatesByProject = await fetchLatestCostEstimatesByProject(supabase);

      let totalMgd = 0;
      let totalRevenue = 0;
      let totalCapex = 0;
      let capexCount = 0;

      for (const p of projects) {
        totalMgd += p.estimated_mgd ?? 0;
        totalRevenue += p.revenue ?? 0;
        const est = estimatesByProject[p.id];
        if (!est) continue;
        const capex = computeCapexTotalFromEstimate(est);
        if (capex == null) continue;
        totalCapex += capex;
        capexCount += 1;
      }

      const summary = {
        generated_at: new Date().toISOString(),
        project_count: projects.length,
        total_mgd: totalMgd,
        total_revenue: totalRevenue,
        total_capex_estimated: totalCapex,
        projects_with_capex: capexCount,
      };

      const inv = projects
        .map((p) => {
          const est = estimatesByProject[p.id];
          const capex = est ? computeCapexTotalFromEstimate(est) : null;
          const revenue = p.revenue ?? null;
          const roi = revenue != null && capex != null && capex > 0 ? revenue / capex : null;
          return {
            project_id: p.id,
            project_name: p.name,
            estimated_mgd: p.estimated_mgd,
            revenue,
            capex_total: capex,
            roi,
          };
        })
        .sort((a, b) => (Number(b.revenue ?? 0) || 0) - (Number(a.revenue ?? 0) || 0));

      setExecutiveSummary(summary);
      setInvestorRows(inv);
      setStatusMessage("Exports ready.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Load failed: ${message}. Did you run supabase/phase2.sql and supabase/phase3.sql?`);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Dashboard Exports</h2>
          <p className="mt-1 text-xs text-slate-300">Download Executive Summary (JSON) and Investor Snapshot (CSV).</p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Executive Summary</p>
          <p className="mt-2 text-xs text-slate-300">JSON download with totals across projects + latest cost estimates.</p>
          <button
            type="button"
            disabled={isBusy || !executiveSummary}
            onClick={() => {
              if (!executiveSummary) return;
              const filename = `executive_summary_${new Date().toISOString().slice(0, 10)}.json`;
              const content = JSON.stringify(executiveSummary, null, 2);
              downloadTextFile(filename, content, "application/json");
              void (async () => {
                try {
                  const persisted = await persistExportToSupabase({
                    supabase,
                    exportType: "executive_summary_json",
                    fileName: filename,
                    contentType: "application/json",
                    content,
                    params: { source: "dashboards/exports" },
                  });

                  if (persisted) {
                    setStatusMessage(`Downloaded + uploaded to planning_exports: ${persisted.storagePath}`);
                  } else {
                    setStatusMessage("Downloaded. (Upload skipped — run supabase/phase3.sql + supabase/phase4.sql to enable export history.)");
                  }
                } catch {
                  setStatusMessage("Downloaded. (Upload skipped.)");
                }
              })();
            }}
            className="mt-3 rounded-md border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
          >
            Download JSON
          </button>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Investor Snapshot</p>
          <p className="mt-2 text-xs text-slate-300">CSV download of project revenue, capex, and ROI.</p>
          <button
            type="button"
            disabled={isBusy || investorRows.length === 0}
            onClick={() => {
              const filename = `investor_snapshot_${new Date().toISOString().slice(0, 10)}.csv`;
              const csv = toCsv(investorRows as any);
              downloadTextFile(filename, csv, "text/csv");
              void (async () => {
                try {
                  const persisted = await persistExportToSupabase({
                    supabase,
                    exportType: "investor_snapshot_csv",
                    fileName: filename,
                    contentType: "text/csv",
                    content: csv,
                    params: { source: "dashboards/exports" },
                  });

                  if (persisted) {
                    setStatusMessage(`Downloaded + uploaded to planning_exports: ${persisted.storagePath}`);
                  } else {
                    setStatusMessage("Downloaded. (Upload skipped — run supabase/phase3.sql + supabase/phase4.sql to enable export history.)");
                  }
                } catch {
                  setStatusMessage("Downloaded. (Upload skipped.)");
                }
              })();
            }}
            className="mt-3 rounded-md border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{statusMessage}</p>
      ) : null}
    </div>
  );
}
