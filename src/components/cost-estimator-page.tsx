"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProjects } from "@/lib/projects-api";
import { fetchLatestCostEstimateForProject, upsertCostEstimate } from "@/lib/cost-estimator-api";
import { readActiveProjectSelection } from "@/lib/project-session";
import type { ProjectRow } from "@/types/phase2";
import type { RouteCostEstimateRow } from "@/types/phase3";

function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function CostEstimatorPage() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<Array<Pick<ProjectRow, "id" | "name">>>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [activeProjectName, setActiveProjectName] = useState<string>("");
  const [loadedRow, setLoadedRow] = useState<RouteCostEstimateRow | null>(null);

  const [pipelineMiles, setPipelineMiles] = useState<string>("");
  const [costPerMile, setCostPerMile] = useState<string>("");
  const [pumpCost, setPumpCost] = useState<string>("");
  const [tankCost, setTankCost] = useState<string>("");
  const [landCost, setLandCost] = useState<string>("");
  const [engPct, setEngPct] = useState<string>("");
  const [permPct, setPermPct] = useState<string>("");
  const [contPct, setContPct] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const selected = readActiveProjectSelection();
    if (selected?.id) {
      setProjectId(selected.id);
      setActiveProjectName(selected.name);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const next = await fetchProjects(supabase);
        setProjects(next.map((row) => ({ id: row.id, name: row.name })));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Projects failed to load: ${message}. Run supabase/phase2.sql.`);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (!projectId) {
      setLoadedRow(null);
      setPipelineMiles("");
      setCostPerMile("");
      setPumpCost("");
      setTankCost("");
      setLandCost("");
      setEngPct("");
      setPermPct("");
      setContPct("");
      setNotes("");
      return;
    }

    void (async () => {
      setIsBusy(true);
      try {
        const row = await fetchLatestCostEstimateForProject(supabase, projectId);
        setLoadedRow(row);
        setPipelineMiles(row?.pipeline_miles == null ? "" : String(row.pipeline_miles));
        setCostPerMile(row?.cost_per_mile == null ? "" : String(row.cost_per_mile));
        setPumpCost(row?.pump_station_cost == null ? "" : String(row.pump_station_cost));
        setTankCost(row?.storage_tank_cost == null ? "" : String(row.storage_tank_cost));
        setLandCost(row?.land_easement_cost == null ? "" : String(row.land_easement_cost));
        setEngPct(row?.engineering_design_pct == null ? "" : String(row.engineering_design_pct));
        setPermPct(row?.permitting_environmental_pct == null ? "" : String(row.permitting_environmental_pct));
        setContPct(row?.contingency_pct == null ? "" : String(row.contingency_pct));
        setNotes(row?.notes ?? "");
        setStatus(row ? "Loaded saved estimate." : "No saved estimate yet.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Load failed: ${message}. Did you re-run supabase/phase3.sql (RPC additions)?`);
      } finally {
        setIsBusy(false);
      }
    })();
  }, [projectId, supabase]);

  const calculated = useMemo(() => {
    const miles = numOrNull(pipelineMiles) ?? 0;
    const cpm = numOrNull(costPerMile) ?? 0;
    const pump = numOrNull(pumpCost) ?? 0;
    const tank = numOrNull(tankCost) ?? 0;
    const land = numOrNull(landCost) ?? 0;
    const base = miles * cpm + pump + tank + land;

    const eng = numOrNull(engPct) ?? 0;
    const perm = numOrNull(permPct) ?? 0;
    const cont = numOrNull(contPct) ?? 0;
    const pct = (eng + perm + cont) / 100;
    const total = base * (1 + pct);

    return {
      base,
      total,
    };
  }, [contPct, costPerMile, engPct, landCost, permPct, pipelineMiles, pumpCost, tankCost]);

  async function handleSave() {
    if (!projectId) {
      setStatus("Select a project first.");
      return;
    }

    setIsBusy(true);
    try {
      const id = await upsertCostEstimate(supabase, {
        id: loadedRow?.id ?? null,
        project_id: projectId,
        pipeline_miles: numOrNull(pipelineMiles),
        cost_per_mile: numOrNull(costPerMile),
        pump_station_cost: numOrNull(pumpCost),
        storage_tank_cost: numOrNull(tankCost),
        land_easement_cost: numOrNull(landCost),
        engineering_design_pct: numOrNull(engPct),
        permitting_environmental_pct: numOrNull(permPct),
        contingency_pct: numOrNull(contPct),
        notes: notes.trim() ? notes : null,
      });

      const refreshed = await fetchLatestCostEstimateForProject(supabase, projectId);
      setLoadedRow(refreshed);
      setStatus(`Saved (id: ${id}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}. Did you re-run supabase/phase3.sql (RPC additions)?`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Cost Estimator</h2>
      <p className="mt-1 text-xs text-slate-300">
        Estimate total project cost using miles, cost-per-mile, pump/tank costs, land/easement, and percentages.
      </p>
      <p className="mt-1 text-[11px] text-slate-400">Active project: {activeProjectName || "None selected"}</p>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <label className="block text-xs font-semibold text-slate-200">Project</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
        >
          <option value="">(choose)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-200">Pipeline miles</label>
            <input value={pipelineMiles} onChange={(e) => setPipelineMiles(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200">Cost per mile</label>
            <input value={costPerMile} onChange={(e) => setCostPerMile(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">Pump station cost</label>
            <input value={pumpCost} onChange={(e) => setPumpCost(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200">Storage tank cost</label>
            <input value={tankCost} onChange={(e) => setTankCost(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">Land / easement cost</label>
            <input value={landCost} onChange={(e) => setLandCost(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">Engineering/design %</label>
            <input value={engPct} onChange={(e) => setEngPct(e.target.value)} inputMode="decimal" placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200">Permitting/environmental %</label>
            <input value={permPct} onChange={(e) => setPermPct(e.target.value)} inputMode="decimal" placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">Contingency %</label>
            <input value={contPct} onChange={(e) => setContPct(e.target.value)} inputMode="decimal" placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div className="rounded border border-white/10 bg-slate-950/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Totals</p>
            <p className="mt-2 text-sm text-slate-100">
              Base: <span className="font-semibold">{formatMoney(calculated.base)}</span>
            </p>
            <p className="mt-1 text-sm text-slate-100">
              Total: <span className="font-semibold">{formatMoney(calculated.total)}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!projectId || isBusy}
          className="mt-3 rounded-md border border-teal-600 bg-teal-800/40 px-3 py-2 text-sm font-semibold text-teal-100 disabled:opacity-50"
        >
          {isBusy ? "Working..." : "Save Estimate"}
        </button>
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
