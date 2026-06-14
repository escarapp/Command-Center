"use client";

import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as turf from "@turf/turf";
import { createClient } from "@/lib/supabase/client";
import { deleteRowCorridor, fetchRowCorridorsGeojson, upsertRowCorridor, type RowCorridorFeature } from "@/lib/row-corridors-api";

const RGV_CENTER: [number, number] = [-97.7, 26.2];
const SOURCE_ID = "row-corridors-src";
const LAYER_LINE = "row-corridors-line";
const LAYER_FILL = "row-corridors-fill";
const LAYER_POINT = "row-corridors-point";

function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function RowCorridorsPage() {
  const supabase = useMemo(() => createClient(), []);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [features, setFeatures] = useState<RowCorridorFeature[]>([]);
  const [visibleIds, setVisibleIds] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = useMemo(() => features.find((f) => String(f.id) === selectedId) ?? null, [features, selectedId]);

  const [name, setName] = useState<string>("");
  const [corridorType, setCorridorType] = useState<string>("");
  const [corridorOwner, setCorridorOwner] = useState<string>("");
  const [widthFt, setWidthFt] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [verification, setVerification] = useState<"unverified" | "partial" | "verified">("unverified");
  const [notes, setNotes] = useState<string>("");

  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const visibleFeatureCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    const filtered = features.filter((f) => {
      const id = String(f.id ?? "");
      return visibleIds[id] !== false;
    });
    return { type: "FeatureCollection", features: filtered as unknown as GeoJSON.Feature[] };
  }, [features, visibleIds]);

  const reload = useCallback(async () => {
    const fc = await fetchRowCorridorsGeojson(supabase);
    const nextFeatures = (fc.features ?? []) as RowCorridorFeature[];
    setFeatures(nextFeatures);
    setVisibleIds((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const f of nextFeatures) {
        const id = String(f.id ?? "");
        if (!(id in next)) next[id] = true;
      }
      return next;
    });
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Load failed: ${message}. Did you re-run supabase/phase3.sql (ROW RPC additions)?`);
      }
    })();
  }, [reload]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    (globalThis as unknown as { mapboxgl: typeof maplibregl }).mapboxgl = maplibregl;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: RGV_CENTER,
      zoom: 9,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { point: true, line_string: true, polygon: true, trash: true },
      userProperties: true,
    });
    map.addControl(draw as unknown as maplibregl.IControl, "top-left");
    mapRef.current = map;
    drawRef.current = draw;

    map.on("load", () => {
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      } as any);

      map.addLayer({
        id: LAYER_FILL,
        type: "fill",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#3bb2d0", "fill-opacity": 0.12 },
      } as any);

      map.addLayer({
        id: LAYER_LINE,
        type: "line",
        source: SOURCE_ID,
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
        paint: { "line-color": "#3bb2d0", "line-width": 2 },
      } as any);

      map.addLayer({
        id: LAYER_POINT,
        type: "circle",
        source: SOURCE_ID,
        filter: ["in", ["geometry-type"], ["literal", ["Point", "MultiPoint"]]],
        paint: { "circle-color": "#3bb2d0", "circle-radius": 4 },
      } as any);
    });

    map.on("draw.create", () => setStatus("Geometry drawn. Click Save to store it."));
    map.on("draw.update", () => setStatus("Geometry updated. Click Save to store it."));

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    try {
      src.setData(visibleFeatureCollection as any);
    } catch {
      // ignore
    }
  }, [visibleFeatureCollection]);

  function clearFormAndDraw() {
    setSelectedId("");
    setName("");
    setCorridorType("");
    setCorridorOwner("");
    setWidthFt("");
    setSource("");
    setVerification("unverified");
    setNotes("");
    const draw = drawRef.current;
    if (draw) {
      try {
        draw.deleteAll();
      } catch {
        // ignore
      }
    }
  }

  function loadSelectedIntoForm() {
    if (!selected) return;
    setName(selected.properties.name ?? "");
    setCorridorType(selected.properties.corridor_type ?? "");
    setCorridorOwner(selected.properties.corridor_owner ?? "");
    setWidthFt(selected.properties.width_ft == null ? "" : String(selected.properties.width_ft));
    setSource(selected.properties.source ?? "");
    setVerification(selected.properties.verification_status ?? "unverified");
    setNotes(selected.properties.notes ?? "");

    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;
    try {
      draw.deleteAll();
      draw.add({ type: "Feature", properties: {}, geometry: selected.geometry });
      const bbox = turf.bbox(selected as any);
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: 40, maxZoom: 14 },
      );
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    loadSelectedIntoForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function getDrawnGeometry(): GeoJSON.Geometry | null {
    const draw = drawRef.current;
    if (!draw) return null;
    const all = draw.getAll();
    const first = (all.features ?? [])[0] as GeoJSON.Feature | undefined;
    if (!first?.geometry) return null;
    return first.geometry as GeoJSON.Geometry;
  }

  async function handleSave() {
    if (!name.trim()) {
      setStatus("Name is required.");
      return;
    }
    if (!corridorType.trim()) {
      setStatus("Corridor type is required.");
      return;
    }
    const geom = getDrawnGeometry();
    if (!geom) {
      setStatus("Draw a corridor geometry on the map first (point/line/polygon). ");
      return;
    }

    setIsBusy(true);
    try {
      const savedId = await upsertRowCorridor(supabase, {
        id: selectedId ? selectedId : null,
        name,
        corridor_type: corridorType,
        corridor_owner: corridorOwner,
        width_ft: numOrNull(widthFt),
        source,
        verification_status: verification,
        notes,
        geometry: geom,
      });
      await reload();
      setSelectedId(savedId);
      setStatus("Saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}. Did you re-run supabase/phase3.sql (ROW RPC additions)?`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    const ok = window.confirm("Delete this corridor feature?");
    if (!ok) return;
    setIsBusy(true);
    try {
      await deleteRowCorridor(supabase, selectedId);
      clearFormAndDraw();
      await reload();
      setStatus("Deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-1 bg-slate-950 lg:grid-cols-[420px_1fr]">
      <aside className="z-10 h-[46vh] overflow-y-auto border-b border-white/10 bg-slate-900/95 p-4 lg:h-full lg:border-b-0 lg:border-r">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">ROW Corridors</h2>
        <p className="mt-1 text-xs text-slate-300">Create corridor features (roads/rail/canals/ROW) with tags.</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              clearFormAndDraw();
              setStatus("Draw a new corridor geometry, fill fields, then Save.");
            }}
            disabled={isBusy}
            className="rounded-md border border-cyan-600 bg-cyan-800/40 px-2 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
          >
            New Corridor
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isBusy}
            className="rounded-md border border-teal-600 bg-teal-800/40 px-2 py-2 text-xs font-semibold text-teal-100 disabled:opacity-50"
          >
            {isBusy ? "Working..." : "Save"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={!selectedId || isBusy}
          className="mt-2 w-full rounded-md border border-rose-600 bg-rose-800/30 px-2 py-2 text-xs font-semibold text-rose-100 disabled:opacity-50"
        >
          Delete Selected
        </button>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Edit</p>
          <div className="mt-2 grid gap-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Corridor type</label>
              <input value={corridorType} onChange={(e) => setCorridorType(e.target.value)} placeholder="Road / Rail / Canal / Easement" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Owner</label>
                <input value={corridorOwner} onChange={(e) => setCorridorOwner(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Width (ft)</label>
                <input value={widthFt} onChange={(e) => setWidthFt(e.target.value)} inputMode="decimal" placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Source</label>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Verification</label>
              <select
                value={verification}
                onChange={(e) => setVerification(e.target.value as any)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
              >
                <option value="unverified">unverified</option>
                <option value="partial">partial</option>
                <option value="verified">verified</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Geometry: draw a point/line/polygon on the map, then Save.</p>
        </div>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">List</p>
          {features.length === 0 ? (
            <p className="mt-2 text-xs text-slate-300">No corridors yet.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {features
                .slice()
                .sort((a, b) => (a.properties.name ?? "").localeCompare(b.properties.name ?? ""))
                .map((f) => {
                  const id = String(f.id ?? "");
                  return (
                    <div key={id} className="flex items-start gap-2 rounded border border-slate-700 bg-slate-900/40 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={visibleIds[id] !== false}
                        onChange={(e) => setVisibleIds((prev) => ({ ...prev, [id]: e.target.checked }))}
                        className="mt-0.5"
                        title="Toggle visibility"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedId(id)}
                        className={`min-w-0 flex-1 text-left text-xs ${selectedId === id ? "text-cyan-200" : "text-slate-100"}`}
                        title="Select and edit"
                      >
                        <div className="truncate font-semibold">{f.properties.name}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {f.properties.corridor_type}
                          {f.properties.verification_status ? ` · ${f.properties.verification_status}` : ""}
                        </div>
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
      </aside>

      <div className="relative h-[54vh] lg:h-full">
        <div ref={mapContainerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
