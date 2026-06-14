"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchPopulationData, fetchUtilities, upsertPopulationData } from "@/lib/market-intelligence-api";
import type { PopulationDataRow, UtilityProfileRow } from "@/types/phase7";

function num(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function MarketGrowthTrendsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [utilities, setUtilities] = useState<UtilityProfileRow[]>([]);
  const [rows, setRows] = useState<PopulationDataRow[]>([]);
  const [utilityId, setUtilityId] = useState("");
  const [population, setPopulation] = useState("0");
  const [growthRate, setGrowthRate] = useState("0");
  const [newDevelopments, setNewDevelopments] = useState("0");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [u, p] = await Promise.all([fetchUtilities(supabase), fetchPopulationData(supabase)]);
      setUtilities(u);
      setRows(p);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase7.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleSave() {
    try {
      await upsertPopulationData(supabase, {
        utility_id: utilityId,
        population: num(population),
        growth_rate_pct: num(growthRate),
        new_developments: num(newDevelopments),
        data_year: num(year),
        notes,
      });
      await reload();
      setStatus("Growth data saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Market Intelligence · Growth Trends</h2>
      <p className="mt-1 text-xs text-slate-300">Track population, growth rate, and new developments by utility.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <select value={utilityId} onChange={(e) => setUtilityId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">Select utility</option>
          {utilities.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={population} onChange={(e) => setPopulation(e.target.value)} placeholder="Population" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={growthRate} onChange={(e) => setGrowthRate(e.target.value)} placeholder="Growth rate %" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={newDevelopments} onChange={(e) => setNewDevelopments(e.target.value)} placeholder="New developments" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void handleSave()} disabled={!utilityId} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
          Save Growth Data
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => {
          const utility = utilities.find((u) => u.id === row.utility_id);
          return (
            <div key={row.id} className="rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
              <p className="text-sm font-semibold text-slate-100">{utility?.name ?? row.utility_id}</p>
              <p>Year {row.data_year} · Population {row.population.toLocaleString()} · Growth {row.growth_rate_pct}% · New developments {row.new_developments}</p>
            </div>
          );
        })}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
