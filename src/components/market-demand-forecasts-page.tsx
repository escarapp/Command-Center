"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchDemandForecasts, fetchUtilities, upsertDemandForecast } from "@/lib/market-intelligence-api";
import type { DemandForecastRow, UtilityProfileRow } from "@/types/phase7";

function num(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function MarketDemandForecastsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [utilities, setUtilities] = useState<UtilityProfileRow[]>([]);
  const [rows, setRows] = useState<DemandForecastRow[]>([]);
  const [utilityId, setUtilityId] = useState("");
  const [currentDemand, setCurrentDemand] = useState("0");
  const [d5, setD5] = useState("0");
  const [d10, setD10] = useState("0");
  const [d20, setD20] = useState("0");
  const [assumptions, setAssumptions] = useState("");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [u, d] = await Promise.all([fetchUtilities(supabase), fetchDemandForecasts(supabase)]);
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
      await upsertDemandForecast(supabase, {
        utility_id: utilityId,
        current_demand_mgd: num(currentDemand),
        demand_5y_mgd: num(d5),
        demand_10y_mgd: num(d10),
        demand_20y_mgd: num(d20),
        assumptions,
      });
      await reload();
      setStatus("Forecast saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    }
  }

  const byUtility = new Map(rows.map((r) => [r.utility_id, r]));

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Market Intelligence · Demand Forecasts</h2>
      <p className="mt-1 text-xs text-slate-300">Store current and 5/10/20-year MGD demand forecasts.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <select value={utilityId} onChange={(e) => setUtilityId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">Select utility</option>
          {utilities.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <input value={currentDemand} onChange={(e) => setCurrentDemand(e.target.value)} placeholder="Current demand (MGD)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={d5} onChange={(e) => setD5(e.target.value)} placeholder="5-year demand (MGD)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={d10} onChange={(e) => setD10(e.target.value)} placeholder="10-year demand (MGD)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={d20} onChange={(e) => setD20(e.target.value)} placeholder="20-year demand (MGD)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} rows={2} placeholder="Assumptions" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void handleSave()} disabled={!utilityId} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
          Save Forecast
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {utilities.map((u) => {
          const row = byUtility.get(u.id);
          return (
            <div key={u.id} className="rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
              <p className="text-sm font-semibold text-slate-100">{u.name}</p>
              <p>Current: {row?.current_demand_mgd ?? 0} · 5y: {row?.demand_5y_mgd ?? 0} · 10y: {row?.demand_10y_mgd ?? 0} · 20y: {row?.demand_20y_mgd ?? 0}</p>
            </div>
          );
        })}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
