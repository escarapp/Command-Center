"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createCipProject,
  fetchCipProjects,
  fetchOpportunityScores,
  fetchUtilities,
  upsertOpportunityScore,
} from "@/lib/market-intelligence-api";
import type { CipProjectRow, OpportunityScoreRow, UtilityProfileRow } from "@/types/phase7";

function num(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function summary(score: OpportunityScoreRow | undefined) {
  if (!score) return "No score yet.";
  if (score.total_opportunity_score >= 55) return "High-value opportunity: prioritize outreach and proposal development.";
  if (score.total_opportunity_score >= 35) return "Moderate opportunity: continue qualification and stakeholder engagement.";
  return "Lower opportunity right now: monitor demand and funding changes.";
}

export function MarketOpportunitiesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [utilities, setUtilities] = useState<UtilityProfileRow[]>([]);
  const [opRows, setOpRows] = useState<OpportunityScoreRow[]>([]);
  const [cipRows, setCipRows] = useState<CipProjectRow[]>([]);
  const [utilityId, setUtilityId] = useState("");
  const [mgd, setMgd] = useState("0");
  const [revenue, setRevenue] = useState("0");
  const [political, setPolitical] = useState("0");
  const [funding, setFunding] = useState("0");
  const [notes, setNotes] = useState("");
  const [cipName, setCipName] = useState("");
  const [cipCost, setCipCost] = useState("0");
  const [cipDate, setCipDate] = useState("");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [u, o, c] = await Promise.all([fetchUtilities(supabase), fetchOpportunityScores(supabase), fetchCipProjects(supabase)]);
      setUtilities(u);
      setOpRows(o);
      setCipRows(c);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase7.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function saveOpportunity() {
    try {
      await upsertOpportunityScore(supabase, {
        utility_id: utilityId,
        potential_mgd_demand: num(mgd),
        revenue_potential_score: num(revenue),
        political_support_score: num(political),
        funding_access_score: num(funding),
        notes,
      });
      await reload();
      setStatus("Opportunity score saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    }
  }

  async function saveCip() {
    try {
      await createCipProject(supabase, {
        utility_id: utilityId,
        project_name: cipName,
        estimated_cost: num(cipCost),
        completion_date: cipDate || null,
        status: "planned",
        notes: "Created in Market Opportunities module",
      });
      setCipName("");
      setCipCost("0");
      setCipDate("");
      await reload();
      setStatus("CIP project saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`CIP save failed: ${message}`);
    }
  }

  const byUtility = new Map(opRows.map((r) => [r.utility_id, r]));

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Market Intelligence · Opportunities</h2>
      <p className="mt-1 text-xs text-slate-300">Score customer opportunities and track CIP projects with cost and completion dates.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <select value={utilityId} onChange={(e) => setUtilityId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">Select utility</option>
          {utilities.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <input value={mgd} onChange={(e) => setMgd(e.target.value)} placeholder="Potential MGD demand" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="Revenue potential score (0-30)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={political} onChange={(e) => setPolitical(e.target.value)} placeholder="Political support score (0-20)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={funding} onChange={(e) => setFunding(e.target.value)} placeholder="Funding access score (0-20)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opportunity notes" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void saveOpportunity()} disabled={!utilityId} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
          Save Opportunity Score
        </button>
      </div>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <input value={cipName} onChange={(e) => setCipName(e.target.value)} placeholder="CIP project name" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={cipCost} onChange={(e) => setCipCost(e.target.value)} placeholder="Estimated cost" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input type="date" value={cipDate} onChange={(e) => setCipDate(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void saveCip()} disabled={!utilityId || !cipName.trim()} className="rounded border border-teal-600 bg-teal-800/40 px-3 py-2 text-sm font-semibold text-teal-100 disabled:opacity-50">
          Save CIP Project
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {utilities.map((u) => {
          const score = byUtility.get(u.id);
          return (
            <div key={u.id} className="rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
              <p className="text-sm font-semibold text-slate-100">{u.name}</p>
              <p>Opportunity score: {score?.total_opportunity_score ?? 0} · Potential MGD: {score?.potential_mgd_demand ?? 0}</p>
              <p className="text-slate-300">{summary(score)}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Capital Improvement Projects</p>
        <div className="mt-2 space-y-2">
          {cipRows.map((row) => {
            const utility = utilities.find((u) => u.id === row.utility_id);
            return (
              <div key={row.id} className="rounded border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs text-slate-200">
                <p className="text-sm font-semibold text-slate-100">{row.project_name}</p>
                <p>{utility?.name ?? row.utility_id} · {row.status} · ${row.estimated_cost.toLocaleString()} · Target {row.completion_date ?? "n/a"}</p>
              </div>
            );
          })}
        </div>
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
