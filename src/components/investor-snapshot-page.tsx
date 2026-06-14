"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeCapexTotalFromEstimate, fetchDashboardProjects, fetchLatestCostEstimatesByProject } from "@/lib/dashboards-api";

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type InvestorRow = {
  id: string;
  name: string;
  estimated_mgd: number | null;
  revenue: number | null;
  capex_total: number | null;
  roi: number | null;
};

export function InvestorSnapshotPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [rows, setRows] = useState<InvestorRow[]>([]);

  async function reload() {
    setIsBusy(true);
    try {
      const projects = await fetchDashboardProjects(supabase);
      const estimatesByProject = await fetchLatestCostEstimatesByProject(supabase);

      const next: InvestorRow[] = projects.map((p) => {
        const est = estimatesByProject[p.id];
        const capex = est ? computeCapexTotalFromEstimate(est) : null;
        const revenue = p.revenue ?? null;
        const roi = revenue != null && capex != null && capex > 0 ? revenue / capex : null;
        return {
          id: p.id,
          name: p.name,
          estimated_mgd: p.estimated_mgd ?? null,
          revenue,
          capex_total: capex,
          roi,
        };
      });

      next.sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
      setRows(next);
      setStatusMessage("Loaded investor snapshot.");
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

  const totals = useMemo(() => {
    let totalRevenue = 0;
    let totalCapex = 0;
    let revCount = 0;
    let capexCount = 0;

    for (const r of rows) {
      if (r.revenue != null) {
        totalRevenue += r.revenue;
        revCount += 1;
      }
      if (r.capex_total != null) {
        totalCapex += r.capex_total;
        capexCount += 1;
      }
    }

    return {
      totalRevenue,
      totalCapex,
      revCount,
      capexCount,
    };
  }, [rows]);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Investor Snapshot</h2>
          <p className="mt-1 text-xs text-slate-300">Rank projects by revenue and show ROI against latest cost estimate totals.</p>
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

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Revenue (Sum)</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">{formatCurrency(totals.totalRevenue)}</p>
          <p className="mt-1 text-xs text-slate-400">Across {formatNumber(totals.revCount)} projects</p>
        </div>
        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Capex (Sum)</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">{formatCurrency(totals.totalCapex)}</p>
          <p className="mt-1 text-xs text-slate-400">Across {formatNumber(totals.capexCount)} projects with estimates</p>
        </div>
        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Portfolio ROI</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">
            {totals.totalCapex > 0 ? formatNumber(totals.totalRevenue / totals.totalCapex) : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-400">Revenue / Capex</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded border border-white/10 bg-slate-900/40">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
            <tr>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">MGD</th>
              <th className="px-3 py-2">Revenue</th>
              <th className="px-3 py-2">Capex</th>
              <th className="px-3 py-2">ROI</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-slate-300">
                  No projects yet.
                </td>
              </tr>
            ) : (
              rows.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-b border-white/5 last:border-b-0">
                  <td className="px-3 py-2">
                    <p className="text-sm font-semibold text-slate-100">{r.name}</p>
                  </td>
                  <td className="px-3 py-2 text-slate-200">{r.estimated_mgd == null ? "—" : formatNumber(r.estimated_mgd)}</td>
                  <td className="px-3 py-2 text-slate-200">{r.revenue == null ? "—" : formatCurrency(r.revenue)}</td>
                  <td className="px-3 py-2 text-slate-200">{r.capex_total == null ? "—" : formatCurrency(r.capex_total)}</td>
                  <td className="px-3 py-2 text-slate-200">
                    {r.roi == null ? "—" : formatNumber(r.roi)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{statusMessage}</p>
      ) : null}
    </div>
  );
}
