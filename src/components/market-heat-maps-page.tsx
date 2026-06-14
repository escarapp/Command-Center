"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchMarketHeatMap } from "@/lib/market-intelligence-api";
import type { MarketHeatRow } from "@/types/phase7";

function heatColor(score: number) {
  if (score >= 80) return "bg-rose-900/40 border-rose-500/50";
  if (score >= 50) return "bg-amber-900/40 border-amber-500/50";
  return "bg-teal-900/30 border-teal-500/40";
}

export function MarketHeatMapsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<MarketHeatRow[]>([]);
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      setRows(await fetchMarketHeatMap(supabase));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase7.sql and populate market data.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const topGrowth = [...rows].sort((a, b) => b.demand_growth_mgd - a.demand_growth_mgd).slice(0, 5);
  const topRisk = [...rows].sort((a, b) => b.drought_risk_score - a.drought_risk_score).slice(0, 5);
  const topOpportunity = [...rows].sort((a, b) => b.opportunity_score - a.opportunity_score).slice(0, 5);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Market Intelligence · Heat Maps</h2>
      <p className="mt-1 text-xs text-slate-300">Identify highest demand growth, drought risk, and best opportunities.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Highest Demand Growth</p>
          <div className="mt-2 space-y-2">
            {topGrowth.map((r) => (
              <div key={r.utility_id + "-g"} className={`rounded border px-2 py-1 text-xs text-slate-100 ${heatColor(r.heat_score)}`}>
                {r.utility_name} · +{Number(r.demand_growth_mgd).toFixed(2)} MGD
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Highest Drought Risk</p>
          <div className="mt-2 space-y-2">
            {topRisk.map((r) => (
              <div key={r.utility_id + "-r"} className={`rounded border px-2 py-1 text-xs text-slate-100 ${heatColor(r.heat_score)}`}>
                {r.utility_name} · Risk {r.drought_risk_score}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Best Opportunities</p>
          <div className="mt-2 space-y-2">
            {topOpportunity.map((r) => (
              <div key={r.utility_id + "-o"} className={`rounded border px-2 py-1 text-xs text-slate-100 ${heatColor(r.heat_score)}`}>
                {r.utility_name} · Opportunity {r.opportunity_score}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Combined Market Heat Index</p>
        <div className="mt-2 space-y-2">
          {rows.map((r) => (
            <div key={r.utility_id} className={`rounded border px-3 py-2 text-xs text-slate-100 ${heatColor(r.heat_score)}`}>
              <p className="font-semibold">{r.utility_name} ({r.utility_type})</p>
              <p>Heat {Number(r.heat_score).toFixed(2)} · Growth {Number(r.demand_growth_mgd).toFixed(2)} MGD · Drought {r.drought_risk_score} · Opportunity {r.opportunity_score}</p>
            </div>
          ))}
        </div>
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
