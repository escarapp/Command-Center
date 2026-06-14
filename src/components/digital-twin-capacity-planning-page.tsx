"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createDigitalTwinAsset,
  fetchBestExpansionRoutes,
  fetchDigitalTwinAssets,
  fetchDigitalTwinCapacity,
} from "@/lib/digital-twin-api";
import type { DigitalTwinAssetRow, DigitalTwinCapacityRow, ExpansionRouteRow } from "@/types/phase9";

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function DigitalTwinCapacityPlanningPage() {
  const supabase = useMemo(() => createClient(), []);
  const [capacityRows, setCapacityRows] = useState<DigitalTwinCapacityRow[]>([]);
  const [assets, setAssets] = useState<DigitalTwinAssetRow[]>([]);
  const [routes, setRoutes] = useState<ExpansionRouteRow[]>([]);
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<DigitalTwinAssetRow["asset_type"]>("pipeline");
  const [county, setCounty] = useState("");
  const [impactMgd, setImpactMgd] = useState("0");
  const [cost, setCost] = useState("0");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [capacity, assetRows, bestRoutes] = await Promise.all([
        fetchDigitalTwinCapacity(supabase),
        fetchDigitalTwinAssets(supabase),
        fetchBestExpansionRoutes(supabase),
      ]);
      setCapacityRows(capacity);
      setAssets(assetRows);
      setRoutes(bestRoutes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase9.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleAddAsset() {
    try {
      await createDigitalTwinAsset(supabase, {
        asset_name: assetName,
        asset_type: assetType,
        county,
        capacity_impact_mgd: Number(impactMgd) || 0,
        estimated_cost: Number(cost) || 0,
        status: "planned",
        target_year: new Date().getFullYear() + 2,
        risk_score: 45,
        opportunity_score: 70,
      });
      setAssetName("");
      setCounty("");
      setImpactMgd("0");
      setCost("0");
      await reload();
      setStatus("Expansion asset added.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Add asset failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Digital Twin · Capacity Planning</h2>
      <p className="mt-1 text-xs text-slate-300">Simulate deficits/surplus and analyze expansion pipelines, customers, storage, and plants.</p>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Add Expansion Plan</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="Asset name" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <select value={assetType} onChange={(e) => setAssetType(e.target.value as DigitalTwinAssetRow["asset_type"])} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
            <option value="pipeline">Pipeline</option>
            <option value="customer">Customer</option>
            <option value="storage">Storage</option>
            <option value="plant">Plant</option>
            <option value="pump_station">Pump Station</option>
            <option value="reservoir">Reservoir</option>
          </select>
          <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={impactMgd} onChange={(e) => setImpactMgd(e.target.value)} placeholder="Capacity impact MGD" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Estimated cost" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <button type="button" onClick={() => void handleAddAsset()} disabled={!assetName.trim()} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
            Add Asset
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded border border-white/10 bg-slate-900/30">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/60 text-slate-200">
            <tr>
              <th className="px-2 py-2 text-left">County</th>
              <th className="px-2 py-2 text-left">Available Supply</th>
              <th className="px-2 py-2 text-left">Future Supply</th>
              <th className="px-2 py-2 text-left">Projected Demand</th>
              <th className="px-2 py-2 text-left">Deficit</th>
              <th className="px-2 py-2 text-left">Surplus</th>
            </tr>
          </thead>
          <tbody>
            {capacityRows.map((row) => (
              <tr key={row.county} className="border-t border-slate-700 text-slate-200">
                <td className="px-2 py-2 font-semibold text-slate-100">{row.county}</td>
                <td className="px-2 py-2">{Number(row.available_supply_mgd).toFixed(2)}</td>
                <td className="px-2 py-2">{Number(row.future_supply_mgd).toFixed(2)}</td>
                <td className="px-2 py-2">{Number(row.projected_demand_mgd).toFixed(2)}</td>
                <td className="px-2 py-2 text-rose-200">{Number(row.deficit_mgd).toFixed(2)}</td>
                <td className="px-2 py-2 text-emerald-200">{Number(row.surplus_mgd).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Best Expansion Routes</p>
          <div className="mt-2 space-y-2">
            {routes.map((route) => (
              <div key={route.connection_id} className="rounded border border-slate-700 bg-slate-900/40 p-2 text-xs text-slate-200">
                <p className="font-semibold text-slate-100">{route.from_node} to {route.to_node}</p>
                <p>
                  {route.connection_type} · score {Number(route.route_score).toFixed(2)} · {Number(route.capacity_mgd).toFixed(2)} MGD · {Number(route.length_miles).toFixed(2)} mi
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-slate-900/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Expansion Assets</p>
          <div className="mt-2 space-y-2">
            {assets.map((asset) => (
              <div key={asset.id} className="rounded border border-slate-700 bg-slate-900/40 p-2 text-xs text-slate-200">
                <p className="font-semibold text-slate-100">{asset.asset_name}</p>
                <p>
                  {asset.asset_type} · {asset.county ?? "Region"} · impact {Number(asset.capacity_impact_mgd).toFixed(2)} MGD · {money(asset.estimated_cost)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
