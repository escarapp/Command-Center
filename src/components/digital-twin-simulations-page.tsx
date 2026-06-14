"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createSimulationRun, fetchSimulationRuns, fetchSupplyModels, upsertSupplyModel } from "@/lib/digital-twin-api";
import type { SimulationRunRow, SupplyModelRow } from "@/types/phase9";

function numberValue(input: string): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function DigitalTwinSimulationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [supplyRows, setSupplyRows] = useState<SupplyModelRow[]>([]);
  const [runs, setRuns] = useState<SimulationRunRow[]>([]);

  const [name, setName] = useState("RGV Base");
  const [county, setCounty] = useState("");
  const [droughtPct, setDroughtPct] = useState("15");
  const [popGrowth, setPopGrowth] = useState("22");
  const [industrialGrowth, setIndustrialGrowth] = useState("18");
  const [desalMgd, setDesalMgd] = useState("10");
  const [availableSupply, setAvailableSupply] = useState("320");
  const [projectedDemand, setProjectedDemand] = useState("360");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [models, simulationRuns] = await Promise.all([fetchSupplyModels(supabase), fetchSimulationRuns(supabase)]);
      setSupplyRows(models);
      setRuns(simulationRuns);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase9.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleRunSimulation() {
    try {
      const model = await upsertSupplyModel(supabase, {
        model_name: name,
        county,
        drought_pct: numberValue(droughtPct),
        population_growth_pct: numberValue(popGrowth),
        industrial_growth_pct: numberValue(industrialGrowth),
        new_desal_capacity_mgd: numberValue(desalMgd),
        available_supply_mgd: numberValue(availableSupply),
        projected_demand_mgd: numberValue(projectedDemand),
        assumptions: `Population ${popGrowth}%, Industrial ${industrialGrowth}%, Drought ${droughtPct}%`,
      });

      await createSimulationRun(supabase, {
        name: `${name} Scenario`,
        scenario_type: "capacity",
        parameters: {
          county: county || "Region-wide",
          drought_pct: numberValue(droughtPct),
          population_growth_pct: numberValue(popGrowth),
          industrial_growth_pct: numberValue(industrialGrowth),
          new_desal_capacity_mgd: numberValue(desalMgd),
        },
        results: {
          available_supply_mgd: model.available_supply_mgd,
          future_supply_mgd: model.future_supply_mgd,
          projected_demand_mgd: model.projected_demand_mgd,
          deficit_mgd: model.deficit_mgd,
          surplus_mgd: model.surplus_mgd,
        },
        status: "completed",
      });

      await reload();
      setStatus("Simulation completed and saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Simulation failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Digital Twin · Simulations</h2>
      <p className="mt-1 text-xs text-slate-300">Scenario modeling for drought, population growth, industrial growth, and new desal capacity.</p>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Run Scenario</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Scenario name" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County (optional)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={droughtPct} onChange={(e) => setDroughtPct(e.target.value)} placeholder="Drought %" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={popGrowth} onChange={(e) => setPopGrowth(e.target.value)} placeholder="Population growth %" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={industrialGrowth} onChange={(e) => setIndustrialGrowth(e.target.value)} placeholder="Industrial growth %" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={desalMgd} onChange={(e) => setDesalMgd(e.target.value)} placeholder="New desal MGD" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={availableSupply} onChange={(e) => setAvailableSupply(e.target.value)} placeholder="Available supply MGD" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={projectedDemand} onChange={(e) => setProjectedDemand(e.target.value)} placeholder="Projected demand MGD" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <button type="button" onClick={() => void handleRunSimulation()} disabled={!name.trim()} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
            Run Simulation
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded border border-white/10 bg-slate-900/30">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/60 text-slate-200">
            <tr>
              <th className="px-2 py-2 text-left">Model</th>
              <th className="px-2 py-2 text-left">County</th>
              <th className="px-2 py-2 text-left">Avail Supply</th>
              <th className="px-2 py-2 text-left">Future Supply</th>
              <th className="px-2 py-2 text-left">Projected Demand</th>
              <th className="px-2 py-2 text-left">Deficit</th>
              <th className="px-2 py-2 text-left">Surplus</th>
            </tr>
          </thead>
          <tbody>
            {supplyRows.map((row) => (
              <tr key={row.id} className="border-t border-slate-700 text-slate-200">
                <td className="px-2 py-2 font-semibold text-slate-100">{row.model_name}</td>
                <td className="px-2 py-2">{row.county ?? "Region-wide"}</td>
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

      <div className="mt-4 rounded border border-white/10 bg-slate-900/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Simulation Runs</p>
        <div className="mt-2 space-y-2">
          {runs.map((run) => (
            <div key={run.id} className="rounded border border-slate-700 bg-slate-900/40 p-2 text-xs text-slate-200">
              <p className="font-semibold text-slate-100">{run.name} · {run.scenario_type}</p>
              <p>Status {run.status} · {new Date(run.run_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
