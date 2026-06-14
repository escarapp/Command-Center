"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeCapexTotalFromEstimate, fetchDashboardProjects, fetchLatestCostEstimatesByProject } from "@/lib/dashboards-api";

type FundingDeadlineRow = {
  id: string;
  name: string;
  agency: string | null;
  deadline: string | null; // date
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function toDateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ExecutiveSummaryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const [projectCount, setProjectCount] = useState<number>(0);
  const [totalMgd, setTotalMgd] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [projectsWithCapex, setProjectsWithCapex] = useState<number>(0);
  const [totalCapex, setTotalCapex] = useState<number>(0);
  const [followUps14, setFollowUps14] = useState<number>(0);
  const [fundingDeadlines30, setFundingDeadlines30] = useState<number>(0);
  const [fundingUpcoming, setFundingUpcoming] = useState<FundingDeadlineRow[]>([]);

  async function reload() {
    setIsBusy(true);
    try {
      const projects = await fetchDashboardProjects(supabase);
      setProjectCount(projects.length);

      let nextTotalMgd = 0;
      let nextTotalRevenue = 0;
      for (const p of projects) {
        nextTotalMgd += p.estimated_mgd ?? 0;
        nextTotalRevenue += p.revenue ?? 0;
      }
      setTotalMgd(nextTotalMgd);
      setTotalRevenue(nextTotalRevenue);

      const estimatesByProject = await fetchLatestCostEstimatesByProject(supabase);
      let nextCapexSum = 0;
      let nextCapexCount = 0;
      for (const p of projects) {
        const est = estimatesByProject[p.id];
        if (!est) continue;
        const capex = computeCapexTotalFromEstimate(est);
        if (capex == null) continue;
        nextCapexSum += capex;
        nextCapexCount += 1;
      }
      setTotalCapex(nextCapexSum);
      setProjectsWithCapex(nextCapexCount);

      const now = new Date();
      const followUpEnd = new Date(now);
      followUpEnd.setDate(followUpEnd.getDate() + 14);

      const nowIso = now.toISOString();
      const followUpEndIso = followUpEnd.toISOString();

      const [{ data: meetings, error: meetingsError }, { data: notes, error: notesError }] = await Promise.all([
        supabase.from("crm_meetings").select("id,follow_up_at").gte("follow_up_at", nowIso).lte("follow_up_at", followUpEndIso),
        supabase.from("crm_notes").select("id,follow_up_at").gte("follow_up_at", nowIso).lte("follow_up_at", followUpEndIso),
      ]);

      if (meetingsError) throw new Error(meetingsError.message);
      if (notesError) throw new Error(notesError.message);

      const mCount = (meetings ?? []).filter((m) => m.follow_up_at != null).length;
      const nCount = (notes ?? []).filter((n) => n.follow_up_at != null).length;
      setFollowUps14(mCount + nCount);

      const deadlineStart = toDateOnlyString(now);
      const deadlineEndDate = new Date(now);
      deadlineEndDate.setDate(deadlineEndDate.getDate() + 30);
      const deadlineEnd = toDateOnlyString(deadlineEndDate);

      const { data: programs, error: programsError } = await supabase
        .from("funding_programs")
        .select("id,name,agency,deadline")
        .gte("deadline", deadlineStart)
        .lte("deadline", deadlineEnd)
        .order("deadline", { ascending: true });

      if (programsError) throw new Error(programsError.message);

      const upcoming = (programs ?? []) as FundingDeadlineRow[];
      setFundingUpcoming(upcoming);
      setFundingDeadlines30(upcoming.length);

      setStatusMessage("Loaded executive summary.");
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
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Executive Summary</h2>
      <p className="mt-1 text-xs text-slate-300">Portfolio overview from Projects, Cost Estimates, CRM follow-ups, and Funding deadlines.</p>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Projects</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumber(projectCount)}</p>
          <p className="mt-1 text-xs text-slate-400">Total active opportunities</p>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Demand</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumber(totalMgd)}</p>
          <p className="mt-1 text-xs text-slate-400">Estimated MGD (sum)</p>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatCurrency(totalRevenue)}</p>
          <p className="mt-1 text-xs text-slate-400">Projected revenue (sum)</p>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Capex (Estimated)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatCurrency(totalCapex)}</p>
          <p className="mt-1 text-xs text-slate-400">From latest Cost Estimator per project ({projectsWithCapex} projects)</p>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Follow-ups</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumber(followUps14)}</p>
          <p className="mt-1 text-xs text-slate-400">Due in next 14 days (CRM meetings + notes)</p>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Funding</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumber(fundingDeadlines30)}</p>
          <p className="mt-1 text-xs text-slate-400">Deadlines in next 30 days</p>
        </div>
      </div>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Upcoming Funding Deadlines</p>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={isBusy}
            className="rounded-md border border-slate-600 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-slate-100 disabled:opacity-50"
          >
            {isBusy ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {fundingUpcoming.length === 0 ? (
            <p className="text-xs text-slate-300">No deadlines found in the next 30 days.</p>
          ) : (
            fundingUpcoming.slice(0, 10).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-950/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">{row.name}</p>
                  <p className="text-xs text-slate-400">{row.agency ?? "(no agency)"}</p>
                </div>
                <div className="shrink-0 text-xs font-semibold text-slate-200">{row.deadline ?? "(no deadline)"}</div>
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
