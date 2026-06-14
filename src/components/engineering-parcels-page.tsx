"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteParcel, fetchParcels, upsertParcel } from "@/lib/engineering-api";
import type { ParcelRow } from "@/types/phase6";

function numOrNull(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseGeoJsonFeatures(input: string): GeoJSON.Feature[] {
  const parsed = JSON.parse(input) as GeoJSON.FeatureCollection | GeoJSON.Feature;
  if ((parsed as GeoJSON.FeatureCollection).type === "FeatureCollection") {
    return (parsed as GeoJSON.FeatureCollection).features ?? [];
  }
  if ((parsed as GeoJSON.Feature).type === "Feature") return [parsed as GeoJSON.Feature];
  throw new Error("Expected GeoJSON Feature or FeatureCollection");
}

export function EngineeringParcelsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ParcelRow[]>([]);
  const [search, setSearch] = useState("");
  const [parcelId, setParcelId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [acreage, setAcreage] = useState("");
  const [county, setCounty] = useState("");
  const [appraisedValue, setAppraisedValue] = useState("");
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [importText, setImportText] = useState("");

  async function reload() {
    try {
      setRows(await fetchParcels(supabase, search));
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
      await upsertParcel(supabase, {
        parcel_id: parcelId,
        owner_name: ownerName,
        acreage: numOrNull(acreage),
        county,
        appraised_value: numOrNull(appraisedValue),
        source: "manual",
      });
      setParcelId("");
      setOwnerName("");
      setAcreage("");
      setCounty("");
      setAppraisedValue("");
      await reload();
      setStatus("Parcel saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(row: ParcelRow) {
    if (!window.confirm(`Delete parcel ${row.parcel_id}?`)) return;
    setIsBusy(true);
    try {
      await deleteParcel(supabase, row.id);
      await reload();
      setStatus("Parcel deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleImportGeoJson() {
    setIsBusy(true);
    try {
      const features = parseGeoJsonFeatures(importText);
      let imported = 0;
      for (let i = 0; i < features.length; i++) {
        const f = features[i] as GeoJSON.Feature;
        const p = (f.properties ?? {}) as Record<string, unknown>;
        const nextParcelId = String(p.parcel_id ?? p.PARCEL_ID ?? p.account ?? `PARCEL-${Date.now()}-${i + 1}`);
        const nextOwner = String(p.owner_name ?? p.OWNER_NAME ?? p.owner ?? "Unknown Owner");
        await upsertParcel(supabase, {
          parcel_id: nextParcelId,
          owner_name: nextOwner,
          acreage: typeof p.acreage === "number" ? p.acreage : typeof p.ACREAGE === "number" ? (p.ACREAGE as number) : null,
          county: String(p.county ?? p.COUNTY ?? county ?? ""),
          appraised_value:
            typeof p.appraised_value === "number"
              ? p.appraised_value
              : typeof p.APPRAISED_VALUE === "number"
                ? (p.APPRAISED_VALUE as number)
                : null,
          source: "geojson_import",
          metadata: p,
          geometry: (f.geometry as GeoJSON.Geometry) ?? null,
        });
        imported += 1;
      }
      await reload();
      setStatus(`Imported ${imported} parcel feature(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Import failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Engineering · Parcels</h2>
      <p className="mt-1 text-xs text-slate-300">Parcel ownership intelligence with search by owner name or parcel ID.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <input value={parcelId} onChange={(e) => setParcelId(e.target.value)} placeholder="Parcel ID" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner name" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={acreage} onChange={(e) => setAcreage(e.target.value)} placeholder="Acreage" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={appraisedValue} onChange={(e) => setAppraisedValue(e.target.value)} placeholder="Appraised value (USD)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isBusy || !parcelId.trim() || !ownerName.trim()}
          className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
        >
          Save Parcel
        </button>
      </div>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Import County Parcel GeoJSON</p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='Paste FeatureCollection JSON here (must include geometry and parcel fields).'
          rows={6}
          className="mt-2 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-xs"
        />
        <button
          type="button"
          onClick={() => void handleImportGeoJson()}
          disabled={isBusy || !importText.trim()}
          className="mt-2 rounded border border-teal-600 bg-teal-800/40 px-3 py-2 text-xs font-semibold text-teal-100 disabled:opacity-50"
        >
          Import GeoJSON Parcels
        </button>
      </div>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/30 p-3 md:grid-cols-[1fr_auto]">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by owner or parcel ID" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void reload()} className="rounded border border-slate-600 bg-slate-900/40 px-3 py-2 text-xs font-semibold text-slate-100">
          Search
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start justify-between gap-2 rounded border border-slate-700 bg-slate-900/30 px-3 py-2">
            <div className="min-w-0 text-xs text-slate-200">
              <p className="truncate text-sm font-semibold text-slate-100">{row.parcel_id} · {row.owner_name}</p>
              <p>
                County: {row.county ?? "n/a"} · Acreage: {row.acreage ?? "n/a"} · Appraised: {row.appraised_value == null ? "n/a" : `$${row.appraised_value.toLocaleString()}`}
              </p>
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
