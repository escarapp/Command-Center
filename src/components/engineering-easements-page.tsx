"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteEasement, fetchEasements, fetchParcels, upsertEasement } from "@/lib/engineering-api";
import type { EasementRow, ParcelRow } from "@/types/phase6";

type RouteOption = { id: string; name: string; project_id: string };

function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function EngineeringEasementsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<EasementRow[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [parcels, setParcels] = useState<ParcelRow[]>([]);
  const [owner, setOwner] = useState("");
  const [routeId, setRouteId] = useState("");
  const [parcelId, setParcelId] = useState("");
  const [widthFt, setWidthFt] = useState("");
  const [lengthFt, setLengthFt] = useState("");
  const [statusValue, setStatusValue] = useState<EasementRow["status"]>("proposed");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function reload() {
    try {
      const [easements, parcelsRows, routesRes] = await Promise.all([
        fetchEasements(supabase),
        fetchParcels(supabase, ""),
        supabase.from("route_alternatives").select("id,name,project_id").order("updated_at", { ascending: false }).limit(500),
      ]);

      if (routesRes.error) throw new Error(routesRes.error.message);
      setRows(easements);
      setParcels(parcelsRows);
      setRoutes((routesRes.data ?? []) as RouteOption[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase6.sql.`);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setIsBusy(true);
    try {
      await upsertEasement(supabase, {
        easement_owner: owner,
        route_alternative_id: routeId || null,
        parcel_id: parcelId || null,
        width_ft: numOrNull(widthFt),
        length_ft: numOrNull(lengthFt),
        status: statusValue,
        notes,
      });
      setOwner("");
      setRouteId("");
      setParcelId("");
      setWidthFt("");
      setLengthFt("");
      setStatusValue("proposed");
      setNotes("");
      await reload();
      setStatus("Easement saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(row: EasementRow) {
    if (!window.confirm(`Delete easement record for ${row.easement_owner}?`)) return;
    setIsBusy(true);
    try {
      await deleteEasement(supabase, row.id);
      await reload();
      setStatus("Easement deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Engineering · Easements</h2>
      <p className="mt-1 text-xs text-slate-300">Create and track easements linked to route alternatives.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Easement owner" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">Route (optional)</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select value={parcelId} onChange={(e) => setParcelId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">Parcel (optional)</option>
          {parcels.map((p) => (
            <option key={p.id} value={p.id}>{p.parcel_id} · {p.owner_name}</option>
          ))}
        </select>
        <select value={statusValue} onChange={(e) => setStatusValue(e.target.value as EasementRow["status"])} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="proposed">Proposed</option>
          <option value="in_review">In Review</option>
          <option value="negotiating">Negotiating</option>
          <option value="approved">Approved</option>
          <option value="recorded">Recorded</option>
          <option value="closed">Closed</option>
        </select>
        <input value={widthFt} onChange={(e) => setWidthFt(e.target.value)} placeholder="Width (ft)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={lengthFt} onChange={(e) => setLengthFt(e.target.value)} placeholder="Length (ft)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isBusy || !owner.trim()}
          className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
        >
          Save Easement
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start justify-between gap-3 rounded border border-slate-700 bg-slate-900/30 px-3 py-2">
            <div className="text-xs text-slate-200">
              <p className="text-sm font-semibold text-slate-100">{row.easement_owner}</p>
              <p>Status: {row.status} · Width: {row.width_ft ?? "n/a"} ft · Length: {row.length_ft ?? "n/a"} ft</p>
              <p>Route: {row.route_alternative_id ?? "n/a"} · Parcel: {row.parcel_id ?? "n/a"}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleDelete(row)}
              disabled={isBusy}
              className="rounded border border-rose-600 bg-rose-800/30 px-2 py-1 text-xs font-semibold text-rose-100 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
