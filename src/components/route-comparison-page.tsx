"use client";

import type { Feature, LineString } from "geojson";
import * as turf from "@turf/turf";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProjects } from "@/lib/projects-api";
import { readActiveProjectSelection } from "@/lib/project-session";
import { deleteRouteAlternative, fetchRouteAlternativesGeojson, upsertRouteAlternative, type RouteAlternativeFeature } from "@/lib/route-alternatives-api";
import type { ProjectRow } from "@/types/phase2";

const RGV_CENTER: [number, number] = [-97.7, 26.2];

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

function featureLengthMiles(feature: Feature<LineString>): number {
  const miles = turf.length(feature, { units: "miles" });
  return Number(miles.toFixed(2));
}

export function RouteComparisonPage() {
  const supabase = useMemo(() => createClient(), []);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [projects, setProjects] = useState<Array<Pick<ProjectRow, "id" | "name">>>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [activeProjectName, setActiveProjectName] = useState<string>("");

  const [features, setFeatures] = useState<RouteAlternativeFeature[]>([]);
  const [selectedAltId, setSelectedAltId] = useState<string>("");
  const selectedAlt = useMemo(() => features.find((f) => String(f.id) === selectedAltId) ?? null, [features, selectedAltId]);

  const [name, setName] = useState<string>("");
  const [costPerMile, setCostPerMile] = useState<string>("");
  const [crossings, setCrossings] = useState<string>("");
  const [easement, setEasement] = useState<string>("");
  const [permitting, setPermitting] = useState<string>("");
  const [environmental, setEnvironmental] = useState<string>("");
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

  const reload = useCallback(async () => {
    if (!projectId) {
      setFeatures([]);
      return;
    }
    const fc = await fetchRouteAlternativesGeojson(supabase, projectId);
    setFeatures((fc.features ?? []) as RouteAlternativeFeature[]);
  }, [projectId, supabase]);

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
    void (async () => {
      try {
        await reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Load failed: ${message}. Did you re-run supabase/phase3.sql (RPC additions)?`);
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
      controls: { line_string: true, trash: true },
      userProperties: true,
    });

    map.addControl(draw as unknown as maplibregl.IControl, "top-left");
    mapRef.current = map;
    drawRef.current = draw;

    map.on("draw.create", () => {
      setStatus("Route drawn. Click Save to store it.");
    });

    map.on("draw.update", () => {
      setStatus("Route updated. Click Save to store it.");
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  function loadSelectedIntoForm() {
    if (!selectedAlt) return;
    setName(selectedAlt.properties?.name ?? "");
    setCostPerMile(selectedAlt.properties?.cost_per_mile == null ? "" : String(selectedAlt.properties.cost_per_mile));
    setCrossings(selectedAlt.properties?.crossings ?? "");
    setEasement(selectedAlt.properties?.easement_concerns ?? "");
    setPermitting(selectedAlt.properties?.permitting_concerns ?? "");
    setEnvironmental(selectedAlt.properties?.environmental_concerns ?? "");
    setNotes(selectedAlt.properties?.notes ?? "");

    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;
    try {
      draw.deleteAll();
      draw.add({
        type: "Feature",
        properties: {},
        geometry: selectedAlt.geometry,
      });
      const bbox = turf.bbox(selectedAlt as any);
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
    if (!selectedAltId) return;
    loadSelectedIntoForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAltId]);

  function startNewAlternative() {
    setSelectedAltId("");
    setName("");
    setCostPerMile("");
    setCrossings("");
    setEasement("");
    setPermitting("");
    setEnvironmental("");
    setNotes("");
    const draw = drawRef.current;
    if (draw) {
      try {
        draw.deleteAll();
        (draw as unknown as { changeMode: (mode: string) => void }).changeMode("draw_line_string");
      } catch {
        // ignore
      }
    }
    setStatus("Draw Route A/B/C on the map, then Save.");
  }

  function getDrawnGeometry(): GeoJSON.LineString | null {
    const draw = drawRef.current;
    if (!draw) return null;
    const all = draw.getAll();
    const first = (all.features ?? [])[0] as Feature | undefined;
    if (!first || first.geometry?.type !== "LineString") return null;
    return first.geometry as GeoJSON.LineString;
  }

  async function handleSave() {
    if (!projectId) {
      setStatus("Select a project first.");
      return;
    }
    if (!name.trim()) {
      setStatus("Name is required (use A, B, C, or a short label). ");
      return;
    }
    const geom = getDrawnGeometry();
    if (!geom) {
      setStatus("Draw a route line on the map first.");
      return;
    }

    setIsBusy(true);
    try {
      const savedId = await upsertRouteAlternative(supabase, {
        id: selectedAltId ? selectedAltId : null,
        project_id: projectId,
        name,
        cost_per_mile: numOrNull(costPerMile),
        crossings,
        easement_concerns: easement,
        permitting_concerns: permitting,
        environmental_concerns: environmental,
        notes,
        geometry: geom,
      });
      await reload();
      setSelectedAltId(savedId);
      setStatus("Saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}. Did you re-run supabase/phase3.sql (RPC additions)?`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    if (!selectedAltId) return;
    const ok = window.confirm("Delete this alternative?");
    if (!ok) return;
    setIsBusy(true);
    try {
      await deleteRouteAlternative(supabase, selectedAltId);
      setSelectedAltId("");
      const draw = drawRef.current;
      if (draw) {
        try {
          draw.deleteAll();
        } catch {
          // ignore
        }
      }
      await reload();
      setStatus("Deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  const comparisonRows = useMemo(() => {
    return features
      .map((f) => {
        const id = String(f.id ?? "");
        const lengthMiles = featureLengthMiles(f as any);
        const cpm = f.properties.cost_per_mile;
        const total = cpm != null ? lengthMiles * cpm : null;
        return {
          id,
          name: f.properties.name,
          lengthMiles,
          costPerMile: cpm,
          total,
          crossings: f.properties.crossings ?? "",
          easement: f.properties.easement_concerns ?? "",
          permitting: f.properties.permitting_concerns ?? "",
          environmental: f.properties.environmental_concerns ?? "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [features]);

  return (
    <div className="grid h-full grid-cols-1 bg-slate-950 lg:grid-cols-[420px_1fr]">
      <aside className="z-10 h-[46vh] overflow-y-auto border-b border-white/10 bg-slate-900/95 p-4 lg:h-full lg:border-b-0 lg:border-r">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Route Comparison</h2>
        <p className="mt-1 text-xs text-slate-300">Create Route A/B/C alternatives and compare length and cost.</p>
        <p className="mt-1 text-[11px] text-slate-400">Active project: {activeProjectName || "None selected"}</p>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <label className="block text-xs font-semibold text-slate-200">Project</label>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setSelectedAltId("");
            }}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">(choose)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={startNewAlternative}
              disabled={!projectId || isBusy}
              className="rounded-md border border-cyan-600 bg-cyan-800/40 px-2 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
            >
              New Alternative
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!projectId || isBusy}
              className="rounded-md border border-teal-600 bg-teal-800/40 px-2 py-2 text-xs font-semibold text-teal-100 disabled:opacity-50"
            >
              {isBusy ? "Working..." : "Save"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!selectedAltId || isBusy}
            className="mt-2 w-full rounded-md border border-rose-600 bg-rose-800/30 px-2 py-2 text-xs font-semibold text-rose-100 disabled:opacity-50"
          >
            Delete Selected
          </button>
        </div>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Alternatives</p>
          {comparisonRows.length === 0 ? (
            <p className="mt-2 text-xs text-slate-300">No alternatives yet.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {comparisonRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedAltId(row.id)}
                  className={`w-full rounded border border-slate-700 bg-slate-900/40 px-2 py-1.5 text-left text-xs ${selectedAltId === row.id ? "text-cyan-200" : "text-slate-100"}`}
                  title="Select and edit"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{row.name}</span>
                    <span className="shrink-0 text-slate-400">{row.lengthMiles} mi</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {row.costPerMile != null ? `${formatMoney(row.costPerMile)}/mi` : ""}
                    {row.total != null ? ` · total ${formatMoney(row.total)}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Edit</p>
          <div className="mt-2 grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Cost / mile</label>
                <input
                  value={costPerMile}
                  onChange={(e) => setCostPerMile(e.target.value)}
                  inputMode="decimal"
                  placeholder="Optional"
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Crossings</label>
              <input value={crossings} onChange={(e) => setCrossings(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Easement concerns</label>
              <input value={easement} onChange={(e) => setEasement(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Permitting concerns</label>
              <input value={permitting} onChange={(e) => setPermitting(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Environmental concerns</label>
              <input value={environmental} onChange={(e) => setEnvironmental(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Geometry: use the draw tool on the map, then Save.</p>
        </div>

        {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
      </aside>

      <div className="relative h-[54vh] lg:h-full">
        <div ref={mapContainerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
