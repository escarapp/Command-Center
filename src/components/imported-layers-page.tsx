"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downloadUploadedFile, fetchUploadedFiles, uploadPlanningFile } from "@/lib/file-uploads-api";
import { createImportedLayer, deleteImportedLayer, fetchImportedLayers, getImportedLayerGeojson, insertImportedGeometry } from "@/lib/imported-layers-api";
import { iterFeatures, parseGeoFileToFeatureCollection } from "@/lib/geo-import";
import type { UploadedFileRow } from "@/types/phase3";
import type { ImportedLayerRow } from "@/types/phase3";

const ACCEPT = [".geojson", ".json", ".kml", ".kmz", ".zip"].join(",");

function isGisUpload(row: UploadedFileRow) {
  return row.file_kind === "geojson" || row.file_kind === "kml" || row.file_kind === "kmz" || row.file_kind === "shp_zip";
}

export function ImportedLayersPage() {
  const supabase = useMemo(() => createClient(), []);

  const [uploads, setUploads] = useState<UploadedFileRow[]>([]);
  const [layers, setLayers] = useState<ImportedLayerRow[]>([]);

  const [selectedUploadId, setSelectedUploadId] = useState<string>("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [layerName, setLayerName] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  async function reload() {
    const [u, l] = await Promise.all([fetchUploadedFiles(supabase), fetchImportedLayers(supabase)]);
    setUploads(u.filter(isGisUpload));
    setLayers(l);
  }

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Load failed: ${message}. Did you run supabase/phase3.sql?`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleImport() {
    if (!layerName.trim()) {
      setStatus("Layer name is required.");
      return;
    }

    const chosenUpload = selectedUploadId ? uploads.find((u) => u.id === selectedUploadId) ?? null : null;
    if (!chosenUpload && !newFile) {
      setStatus("Pick an existing uploaded GIS file, or choose a new file to upload.");
      return;
    }

    setIsBusy(true);
    try {
      let sourceFileId: string | null = null;
      let fileToParse: File;

      if (chosenUpload) {
        sourceFileId = chosenUpload.id;
        fileToParse = await downloadUploadedFile(supabase, chosenUpload);
      } else {
        const uploaded = await uploadPlanningFile(supabase, {
          file: newFile as File,
          notes: "Imported layer source file",
        });
        sourceFileId = uploaded.id;
        fileToParse = newFile as File;
      }

      setStatus("Parsing file...");
      const fc = await parseGeoFileToFeatureCollection(fileToParse);
      const features = iterFeatures(fc);
      if (features.length === 0) throw new Error("No features found in file");

      if (features.length > 5000) {
        throw new Error(`File has ${features.length} features. For performance, please split the layer under 5000 features.`);
      }

      setStatus("Creating imported layer...");
      const layer = await createImportedLayer(supabase, { name: layerName, source_file_id: sourceFileId });

      let inserted = 0;
      for (const feature of features) {
        if (!feature.geometry) continue;
        const props = (feature.properties ?? {}) as Record<string, unknown>;
        await insertImportedGeometry(supabase, {
          imported_layer_id: layer.id,
          feature_type: feature.geometry.type,
          geometry: feature.geometry,
          properties: props,
        });
        inserted += 1;
        if (inserted % 50 === 0) {
          setStatus(`Importing... ${inserted}/${features.length}`);
        }
      }

      // Warm RPC / validation (optional)
      await getImportedLayerGeojson(supabase, layer.id);

      setStatus(`Imported ${inserted} feature(s) into "${layer.name}".`);
      setLayerName("");
      setNewFile(null);
      setSelectedUploadId("");
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Import failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(layer: ImportedLayerRow) {
    const ok = window.confirm(`Delete imported layer "${layer.name}"? (Geometries will be removed too.)`);
    if (!ok) return;
    setIsBusy(true);
    try {
      await deleteImportedLayer(supabase, layer.id);
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
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Imported Layers</h2>
      <p className="mt-1 text-xs text-slate-300">
        Import GeoJSON/KML/KMZ/Shapefile ZIP into PostGIS and toggle them on/off from the map sidebar.
      </p>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-200">Layer name</label>
            <input
              value={layerName}
              onChange={(e) => setLayerName(e.target.value)}
              placeholder='Example: "FEMA Floodplain"'
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">Import from existing upload</label>
            <select
              value={selectedUploadId}
              onChange={(e) => setSelectedUploadId(e.target.value)}
              disabled={isBusy}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="">(choose a file)</option>
              {uploads.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.filename}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-semibold text-slate-200">Or upload a new GIS file</label>
          <input
            type="file"
            accept={ACCEPT}
            disabled={isBusy}
            onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-400">Supported: GeoJSON, KML, KMZ, zipped shapefile (.zip)</p>
        </div>

        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={isBusy || !layerName.trim()}
          className="mt-3 rounded-md border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
        >
          {isBusy ? "Working..." : "Import Layer"}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {layers.length === 0 ? (
          <p className="text-xs text-slate-300">No imported layers yet.</p>
        ) : (
          layers.map((layer) => (
            <div key={layer.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/30 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{layer.name}</p>
                <p className="text-xs text-slate-400">Updated: {layer.updated_at}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(layer)}
                disabled={isBusy}
                className="rounded border border-rose-600 bg-rose-800/30 px-2 py-1 text-xs font-semibold text-rose-100 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
