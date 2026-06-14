"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchDemandModels, fetchDigitalTwinForecasts, upsertDemandModel } from "@/lib/digital-twin-api";
import type { DemandModelRow, DigitalTwinForecastRow } from "@/types/phase9";

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function DigitalTwinForecastsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [forecasts, setForecasts] = useState<DigitalTwinForecastRow[]>([]);
  const [models, setModels] = useState<DemandModelRow[]>([]);
  const [utilityName, setUtilityName] = useState("");
  const [county, setCounty] = useState("");
  const [baseline, setBaseline] = useState("10");
  const [growth5, setGrowth5] = useState("8");
  const [growth10, setGrowth10] = useState("18");
  const [growth20, setGrowth20] = useState("36");
  const [rev5, setRev5] = useState("15000000");
  const [rev10, setRev10] = useState("22000000");
  const [rev20, setRev20] = useState("36000000");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [forecastRows, demandRows] = await Promise.all([fetchDigitalTwinForecasts(supabase), fetchDemandModels(supabase)]);
      setForecasts(forecastRows);
      setModels(demandRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase9.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleUpsertDemandModel() {
    try {
      await upsertDemandModel(supabase, {
        utility_name: utilityName,
        county,
        baseline_demand_mgd: Number(baseline) || 0,
        growth_5y_pct: Number(growth5) || 0,
        growth_10y_pct: Number(growth10) || 0,
        growth_20y_pct: Number(growth20) || 0,
        projected_revenue_5y: Number(rev5) || 0,
        projected_revenue_10y: Number(rev10) || 0,
        projected_revenue_20y: Number(rev20) || 0,
      });
      setUtilityName("");
      setCounty("");
      await reload();
      setStatus("Demand model saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Digital Twin · Forecasts</h2>
      <p className="mt-1 text-xs text-slate-300">Predictive analytics for demand, revenue, capacity needs, and expansion timing.</p>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Add / Update Demand Forecast</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <input value={utilityName} onChange={(e) => setUtilityName(e.target.value)} placeholder="Utility name" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="Baseline demand MGD" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={growth5} onChange={(e) => setGrowth5(e.target.value)} placeholder="Growth 5Y %" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={growth10} onChange={(e) => setGrowth10(e.target.value)} placeholder="Growth 10Y %" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={growth20} onChange={(e) => setGrowth20(e.target.value)} placeholder="Growth 20Y %" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={rev5} onChange={(e) => setRev5(e.target.value)} placeholder="Revenue 5Y" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={rev10} onChange={(e) => setRev10(e.target.value)} placeholder="Revenue 10Y" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input value={rev20} onChange={(e) => setRev20(e.target.value)} placeholder="Revenue 20Y" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void handleUpsertDemandModel()} disabled={!utilityName.trim()} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded border border-white/10 bg-slate-900/30">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/60 text-slate-200">
            <tr>
              <th className="px-2 py-2 text-left">Utility</th>
              <th className="px-2 py-2 text-left">County</th>
              <th className="px-2 py-2 text-left">Demand 5Y</th>
              <th className="px-2 py-2 text-left">Demand 10Y</th>
              <th className="px-2 py-2 text-left">Demand 20Y</th>
              <th className="px-2 py-2 text-left">Revenue 20Y</th>
              <th className="px-2 py-2 text-left">Capacity Need</th>
              <th className="px-2 py-2 text-left">Expansion Year</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((row) => (
              <tr key={`${row.utility_name}-${row.county}`} className="border-t border-slate-700 text-slate-200">
                <td className="px-2 py-2 font-semibold text-slate-100">{row.utility_name}</td>
                <td className="px-2 py-2">{row.county}</td>
                <td className="px-2 py-2">{Number(row.demand_5y_mgd).toFixed(2)}</td>
                <td className="px-2 py-2">{Number(row.demand_10y_mgd).toFixed(2)}</td>
                <td className="px-2 py-2">{Number(row.demand_20y_mgd).toFixed(2)}</td>
                <td className="px-2 py-2">{money(row.revenue_20y)}</td>
                <td className="px-2 py-2 text-rose-200">{Number(row.capacity_need_mgd).toFixed(2)}</td>
                <td className="px-2 py-2">{row.recommended_expansion_year}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Demand Model Registry</p>
        <div className="mt-2 space-y-2">
          {models.map((model) => (
            <div key={model.id} className="rounded border border-slate-700 bg-slate-900/40 p-2 text-xs text-slate-200">
              <p className="font-semibold text-slate-100">{model.utility_name} · {model.county ?? "Region"}</p>
              <p>Baseline {Number(model.baseline_demand_mgd).toFixed(2)} MGD · 20Y Growth {Number(model.growth_20y_pct).toFixed(2)}%</p>
            </div>
          ))}
        </div>
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
