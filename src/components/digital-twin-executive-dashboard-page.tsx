"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchDigitalTwinDashboard,
  fetchDigitalTwinFundingOpportunities,
  fetchFutureShortagesByCounty,
  fetchNetworkConnections,
  fetchNetworkNodes,
} from "@/lib/digital-twin-api";
import type {
  DigitalTwinDashboardRow,
  FundingOpportunityRow,
  FutureShortageRow,
  NetworkConnectionRow,
  NetworkNodeRow,
} from "@/types/phase9";

export function DigitalTwinExecutiveDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [dashboard, setDashboard] = useState<DigitalTwinDashboardRow | null>(null);
  const [shortages, setShortages] = useState<FutureShortageRow[]>([]);
  const [funding, setFunding] = useState<FundingOpportunityRow[]>([]);
  const [nodes, setNodes] = useState<NetworkNodeRow[]>([]);
  const [connections, setConnections] = useState<NetworkConnectionRow[]>([]);
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [dashRows, shortageRows, fundingRows, nodeRows, connectionRows] = await Promise.all([
        fetchDigitalTwinDashboard(supabase),
        fetchFutureShortagesByCounty(supabase),
        fetchDigitalTwinFundingOpportunities(supabase),
        fetchNetworkNodes(supabase),
        fetchNetworkConnections(supabase),
      ]);
      setDashboard(dashRows[0] ?? null);
      setShortages(shortageRows);
      setFunding(fundingRows);
      setNodes(nodeRows);
      setConnections(connectionRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase9.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const topRisks = shortages.slice(0, 5);
  const topOpportunities = funding.slice(0, 5);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Digital Twin · Executive Command Center</h2>
      <p className="mt-1 text-xs text-slate-300">Large-screen regional command board with live network context, KPIs, risks, and opportunities.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Total Demand</p>
          <p className="mt-1 text-xl font-bold text-cyan-200">{Number(dashboard?.total_demand_mgd ?? 0).toFixed(2)} MGD</p>
        </div>
        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Total Supply</p>
          <p className="mt-1 text-xl font-bold text-cyan-200">{Number(dashboard?.total_supply_mgd ?? 0).toFixed(2)} MGD</p>
        </div>
        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Capacity Gap</p>
          <p className="mt-1 text-xl font-bold text-rose-200">{Number(dashboard?.capacity_gap_mgd ?? 0).toFixed(2)} MGD</p>
        </div>
        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Growth Forecast</p>
          <p className="mt-1 text-xl font-bold text-amber-200">{Number(dashboard?.growth_forecast_mgd ?? 0).toFixed(2)} MGD</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Live Map Context</p>
          <p className="mt-1 text-xs text-slate-300">Network nodes and transmission relationships across the regional digital twin.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="rounded border border-slate-700 bg-slate-900/40 p-2 text-xs text-slate-200">
              <p className="uppercase tracking-[0.1em] text-slate-300">Nodes</p>
              <p className="mt-1 text-lg font-semibold text-cyan-100">{nodes.length}</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900/40 p-2 text-xs text-slate-200">
              <p className="uppercase tracking-[0.1em] text-slate-300">Connections</p>
              <p className="mt-1 text-lg font-semibold text-cyan-100">{connections.length}</p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900/40 p-2 text-xs text-slate-200">
              <p className="uppercase tracking-[0.1em] text-slate-300">High-Risk Assets</p>
              <p className="mt-1 text-lg font-semibold text-rose-100">{dashboard?.high_risk_assets ?? 0}</p>
            </div>
          </div>

          <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
            {connections.slice(0, 12).map((c) => {
              const fromNode = nodes.find((n) => n.id === c.from_node_id)?.name ?? "Unknown";
              const toNode = nodes.find((n) => n.id === c.to_node_id)?.name ?? "Unknown";
              return (
                <div key={c.id} className="rounded border border-slate-700 bg-slate-900/40 px-2 py-1 text-xs text-slate-200">
                  {fromNode} to {toNode} · {c.connection_type} · {Number(c.capacity_mgd).toFixed(2)} MGD
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded border border-white/10 bg-slate-900/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Top Risks</p>
            <div className="mt-2 space-y-2">
              {topRisks.map((row) => (
                <div key={row.county} className="rounded border border-slate-700 bg-slate-900/40 p-2 text-xs text-slate-200">
                  <p className="font-semibold text-slate-100">{row.county}</p>
                  <p>Future shortage {Number(row.shortage_mgd).toFixed(2)} MGD</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-white/10 bg-slate-900/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Top Opportunities</p>
            <div className="mt-2 space-y-2">
              {topOpportunities.map((row) => (
                <div key={row.program_name} className="rounded border border-slate-700 bg-slate-900/40 p-2 text-xs text-slate-200">
                  <p className="font-semibold text-slate-100">{row.program_name}</p>
                  <p>{row.category}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
