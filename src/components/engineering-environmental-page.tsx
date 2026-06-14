"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteEnvironmentalConstraint,
  fetchEnvironmentalConstraints,
  upsertEnvironmentalConstraint,
} from "@/lib/engineering-api";
import type { EnvironmentalConstraintType } from "@/types/phase6";

const REQUIRED_CONSTRAINT_LAYERS: Array<{ key: EnvironmentalConstraintType; label: string }> = [
  { key: "fema_floodplain", label: "FEMA floodplains" },
  { key: "wetlands", label: "Wetlands" },
  { key: "coastal_barriers", label: "Coastal barriers" },
  { key: "protected_habitats", label: "Protected habitats" },
  { key: "water_bodies", label: "Water bodies" },
];

function parseGeoJsonFeatures(input: string): GeoJSON.Feature[] {
  const parsed = JSON.parse(input) as GeoJSON.FeatureCollection | GeoJSON.Feature;
  if ((parsed as GeoJSON.FeatureCollection).type === "FeatureCollection") return (parsed as GeoJSON.FeatureCollection).features ?? [];
  if ((parsed as GeoJSON.Feature).type === "Feature") return [parsed as GeoJSON.Feature];
  throw new Error("Expected GeoJSON Feature or FeatureCollection");
}

export function EngineeringEnvironmentalPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<any[]>([]);
  const [constraintType, setConstraintType] = useState<EnvironmentalConstraintType>("fema_floodplain");
  const [severity, setSeverity] = useState("3");
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function reload() {
    try {
      setRows(await fetchEnvironmentalConstraints(supabase));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase6.sql.`);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleImport() {
    setIsBusy(true);
    try {
      const features = parseGeoJsonFeatures(importText);
      let imported = 0;
      for (let i = 0; i < features.length; i++) {
        const f = features[i] as GeoJSON.Feature;
        if (!f.geometry) continue;
        const props = (f.properties ?? {}) as Record<string, unknown>;
        await upsertEnvironmentalConstraint(supabase, {
          constraint_type: constraintType,
          geometry: f.geometry as GeoJSON.Geometry,
          name: String(props.name ?? props.NAME ?? `${constraintType}-${i + 1}`),
          severity: Number(severity),
          source: "geojson_import",
          notes: "Imported via Engineering Environmental module",
        });
        imported += 1;
      }
      await reload();
      setStatus(`Imported ${imported} environmental constraint feature(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Import failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this environmental feature?")) return;
    setIsBusy(true);
    try {
      await deleteEnvironmentalConstraint(supabase, id);
      await reload();
      setStatus("Constraint deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  const counts = REQUIRED_CONSTRAINT_LAYERS.map((layer) => ({
    ...layer,
    count: rows.filter((r) => r.constraint_type === layer.key).length,
  }));

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Engineering · Environmental Constraints</h2>
      <p className="mt-1 text-xs text-slate-300">Maintain FEMA/wetlands/coastal/habitat/waterbody constraint layers for route screening.</p>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <div className="grid gap-2 md:grid-cols-2">
          <select value={constraintType} onChange={(e) => setConstraintType(e.target.value as EnvironmentalConstraintType)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
            {REQUIRED_CONSTRAINT_LAYERS.map((layer) => (
              <option key={layer.key} value={layer.key}>{layer.label}</option>
            ))}
          </select>
          <input value={severity} onChange={(e) => setSeverity(e.target.value)} placeholder="Severity (1-5)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={7}
          placeholder="Paste environmental GeoJSON (FeatureCollection)"
          className="mt-2 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-xs"
        />
        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={isBusy || !importText.trim()}
          className="mt-2 rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
        >
          Import Constraint Layer
        </button>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {counts.map((item) => (
          <div key={item.key} className="rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
            <p className="font-semibold text-slate-100">{item.label}</p>
            <p>Features: {item.count}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {rows.slice(0, 100).map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
            <p className="truncate">{row.constraint_type} · {row.name ?? "(unnamed)"} · severity {row.severity}</p>
            <button
              type="button"
              onClick={() => void handleDelete(row.id)}
              disabled={isBusy}
              className="rounded border border-rose-600 bg-rose-800/30 px-2 py-1 font-semibold text-rose-100 disabled:opacity-50"
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
