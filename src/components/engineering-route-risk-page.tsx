"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchRouteRiskScores, refreshRouteCrossings } from "@/lib/engineering-api";
import type { EngineeringRouteRiskRow } from "@/types/phase6";

type ProjectOption = { id: string; name: string };
type RouteOption = { id: string; name: string; project_id: string };

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function EngineeringRouteRiskPage() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [rows, setRows] = useState<EngineeringRouteRiskRow[]>([]);
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function reload() {
    try {
      const [projectsRes, routesRes, riskRows] = await Promise.all([
        supabase.from("projects").select("id,name").order("updated_at", { ascending: false }).limit(500),
        supabase.from("route_alternatives").select("id,name,project_id").order("updated_at", { ascending: false }).limit(1000),
        fetchRouteRiskScores(supabase, projectId || undefined),
      ]);
      if (projectsRes.error) throw new Error(projectsRes.error.message);
      if (routesRes.error) throw new Error(routesRes.error.message);
      setProjects((projectsRes.data ?? []) as ProjectOption[]);
      setRoutes((routesRes.data ?? []) as RouteOption[]);
      setRows(riskRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase6.sql and recompute crossings.`);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function recomputeCrossingsForScope() {
    setIsBusy(true);
    try {
      const filtered = projectId ? routes.filter((r) => r.project_id === projectId) : routes;
      for (const route of filtered) {
        await refreshRouteCrossings(supabase, route.id);
      }
      await reload();
      setStatus(`Crossings recalculated for ${filtered.length} route(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Crossing analysis failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Engineering · Route Risk</h2>
      <p className="mt-1 text-xs text-slate-300">Scores routes by environmental risk, ROW complexity, crossings, and land acquisition needs.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-[1fr_auto]">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void recomputeCrossingsForScope()}
          disabled={isBusy}
          className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
        >
          Recalculate Crossings
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded border border-white/10 bg-slate-900/30">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/60 text-slate-200">
            <tr>
              <th className="px-2 py-2 text-left">Route</th>
              <th className="px-2 py-2 text-left">Length (mi)</th>
              <th className="px-2 py-2 text-left">Cost</th>
              <th className="px-2 py-2 text-left">Env Risk</th>
              <th className="px-2 py-2 text-left">ROW Complexity</th>
              <th className="px-2 py-2 text-left">Crossings</th>
              <th className="px-2 py-2 text-left">Land Acquisition</th>
              <th className="px-2 py-2 text-left">Easements</th>
              <th className="px-2 py-2 text-left">Total Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.route_alternative_id} className="border-t border-slate-700 text-slate-200">
                <td className="px-2 py-2 font-semibold text-slate-100">{row.route_name}</td>
                <td className="px-2 py-2">{row.length_miles.toFixed(2)}</td>
                <td className="px-2 py-2">{money(row.estimated_cost)}</td>
                <td className="px-2 py-2">{row.environmental_risk}</td>
                <td className="px-2 py-2">{row.row_complexity}</td>
                <td className="px-2 py-2">{row.crossing_count}</td>
                <td className="px-2 py-2">{row.land_acquisition_needs}</td>
                <td className="px-2 py-2">{row.easement_requirements}</td>
                <td className="px-2 py-2 font-bold text-cyan-200">{row.total_risk_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
