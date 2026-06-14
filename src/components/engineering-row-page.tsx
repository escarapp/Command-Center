"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchEngineeringRowLayers, insertEngineeringRowFeature } from "@/lib/engineering-api";

const REQUIRED_ROW_LAYERS = [
  "TxDOT ROW",
  "County roads",
  "Municipal streets",
  "Railroads",
  "Utility corridors",
  "Drainage corridors",
  "Irrigation corridors",
];

function parseGeoJsonFeatures(input: string): GeoJSON.Feature[] {
  const parsed = JSON.parse(input) as GeoJSON.FeatureCollection | GeoJSON.Feature;
  if ((parsed as GeoJSON.FeatureCollection).type === "FeatureCollection") return (parsed as GeoJSON.FeatureCollection).features ?? [];
  if ((parsed as GeoJSON.Feature).type === "Feature") return [parsed as GeoJSON.Feature];
  throw new Error("Expected GeoJSON Feature or FeatureCollection");
}

export function EngineeringRowPage() {
  const supabase = useMemo(() => createClient(), []);
  const [layerName, setLayerName] = useState(REQUIRED_ROW_LAYERS[0]);
  const [corridorType, setCorridorType] = useState("ROW");
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [counts, setCounts] = useState<Array<{ layer_name: string | null; count: number }>>([]);

  async function reload() {
    try {
      setCounts(await fetchEngineeringRowLayers(supabase));
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
      let inserted = 0;
      for (let i = 0; i < features.length; i++) {
        const f = features[i] as GeoJSON.Feature;
        if (!f.geometry) continue;
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const featureName = String(props.name ?? props.NAME ?? `${layerName} ${i + 1}`);
        await insertEngineeringRowFeature(supabase, {
          layer_name: layerName,
          name: featureName,
          corridor_type: corridorType,
          notes: "Imported via Engineering ROW module",
          geometry: f.geometry as GeoJSON.Geometry,
        });
        inserted += 1;
      }
      await reload();
      setStatus(`Imported ${inserted} ROW feature(s) into ${layerName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Import failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Engineering · ROW Layer Library</h2>
      <p className="mt-1 text-xs text-slate-300">Load and maintain TxDOT/County/Municipal/Rail/Utility/Drainage/Irrigation corridor layers.</p>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <div className="grid gap-2 md:grid-cols-2">
          <select value={layerName} onChange={(e) => setLayerName(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
            {REQUIRED_ROW_LAYERS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input value={corridorType} onChange={(e) => setCorridorType(e.target.value)} placeholder="Corridor type label" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={7}
          placeholder="Paste ROW layer GeoJSON (FeatureCollection)"
          className="mt-2 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-xs"
        />
        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={isBusy || !importText.trim()}
          className="mt-2 rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
        >
          Import ROW Layer
        </button>
      </div>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Layer Inventory</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {REQUIRED_ROW_LAYERS.map((name) => {
            const count = counts.find((c) => c.layer_name === name)?.count ?? 0;
            return (
              <div key={name} className="rounded border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs text-slate-200">
                <p className="font-semibold text-slate-100">{name}</p>
                <p>Features: {count}</p>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-300">
        Need manual geometry editing? Use the full drawing tool in <Link href="/planning/row-corridors" className="text-cyan-300 underline">Planning → ROW Corridors</Link>.
      </p>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
