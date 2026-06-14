"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchDroughtScores, fetchUtilities, upsertDroughtScore } from "@/lib/market-intelligence-api";
import type { DroughtScoreRow, UtilityProfileRow } from "@/types/phase7";

function num(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function MarketDroughtRiskPage() {
  const supabase = useMemo(() => createClient(), []);
  const [utilities, setUtilities] = useState<UtilityProfileRow[]>([]);
  const [rows, setRows] = useState<DroughtScoreRow[]>([]);
  const [utilityId, setUtilityId] = useState("");
  const [sourceDep, setSourceDep] = useState("0");
  const [reservoir, setReservoir] = useState("0");
  const [shortages, setShortages] = useState("0");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [u, d] = await Promise.all([fetchUtilities(supabase), fetchDroughtScores(supabase)]);
      setUtilities(u);
      setRows(d);
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
      await upsertDroughtScore(supabase, {
        utility_id: utilityId,
        water_source_dependency_score: num(sourceDep),
        reservoir_exposure_score: num(reservoir),
        historic_shortages_score: num(shortages),
        notes,
      });
      await reload();
      setStatus("Drought score saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Market Intelligence · Drought Risk</h2>
      <p className="mt-1 text-xs text-slate-300">Score source dependency, reservoir exposure, and historic shortages.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <select value={utilityId} onChange={(e) => setUtilityId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">Select utility</option>
          {utilities.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <input value={sourceDep} onChange={(e) => setSourceDep(e.target.value)} placeholder="Source dependency (0-40)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={reservoir} onChange={(e) => setReservoir(e.target.value)} placeholder="Reservoir exposure (0-30)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={shortages} onChange={(e) => setShortages(e.target.value)} placeholder="Historic shortages (0-30)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void handleSave()} disabled={!utilityId} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
          Save Drought Score
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => {
          const utility = utilities.find((u) => u.id === row.utility_id);
          return (
            <div key={row.id} className="rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
              <p className="text-sm font-semibold text-slate-100">{utility?.name ?? row.utility_id}</p>
              <p>Dependency: {row.water_source_dependency_score} · Reservoir: {row.reservoir_exposure_score} · Shortages: {row.historic_shortages_score} · Total: {row.total_score}</p>
            </div>
          );
        })}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
