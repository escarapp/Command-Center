"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downloadUploadedFile, fetchUploadedFiles, uploadPlanningFile } from "@/lib/file-uploads-api";
import { createMapOverlay, deleteMapOverlay, fetchMapOverlays, getOverlaySignedUrl, isValidCorners, updateMapOverlayCorners, updateMapOverlayOpacity, type OverlayCorners } from "@/lib/map-overlays-api";
import type { MapOverlayRow, UploadedFileRow } from "@/types/phase3";

const RGV_CENTER: [number, number] = [-97.7, 26.2];
const ACCEPT = [".pdf", ".png", ".jpg", ".jpeg"].join(",");

function isOverlayUpload(row: UploadedFileRow) {
  return row.file_kind === "pdf" || row.file_kind === "png" || row.file_kind === "jpg" || row.file_kind === "jpeg";
}

async function getImageSize(file: File): Promise<{ width: number; height: number }> {
  try {
    // Fast path
    const bmp = await createImageBitmap(file);
    return { width: bmp.width, height: bmp.height };
  } catch {
    // Fallback
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to decode image"));
      };
      img.src = url;
    });
  }
}

async function pdfToPngFirstPage(pdfFile: File): Promise<{ png: File; width: number; height: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = await pdfFile.arrayBuffer();

  const loadingTask = pdfjs.getDocument({ data, disableWorker: true } as any);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  await page.render({ canvasContext: ctx, viewport } as any).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create PNG"))), "image/png");
  });

  const filename = pdfFile.name.replace(/\.pdf$/i, "") + "_page1.png";
  const png = new File([blob], filename, { type: "image/png" });
  return { png, width: canvas.width, height: canvas.height };
}

export function MapOverlaysPage() {
  const supabase = useMemo(() => createClient(), []);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const clickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

  const [uploads, setUploads] = useState<UploadedFileRow[]>([]);
  const [overlays, setOverlays] = useState<MapOverlayRow[]>([]);
  const [visibleOverlays, setVisibleOverlays] = useState<Record<string, boolean>>({});

  const [selectedOverlayId, setSelectedOverlayId] = useState<string>("");
  const selectedOverlay = useMemo(() => overlays.find((o) => o.id === selectedOverlayId) ?? null, [overlays, selectedOverlayId]);

  const [overlayName, setOverlayName] = useState("");
  const [selectedUploadId, setSelectedUploadId] = useState<string>("");
  const [newFile, setNewFile] = useState<File | null>(null);

  const [cornerDraft, setCornerDraft] = useState<Array<[number, number]>>([]);
  const [isPlacingCorners, setIsPlacingCorners] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  async function reload() {
    const [u, o] = await Promise.all([fetchUploadedFiles(supabase), fetchMapOverlays(supabase)]);
    setUploads(u.filter(isOverlayUpload));
    setOverlays(o);
    setVisibleOverlays((prev) => {
      const base = o.reduce((acc, row) => {
        acc[row.id] = true;
        return acc;
      }, {} as Record<string, boolean>);
      Object.keys(base).forEach((id) => {
        if (Object.prototype.hasOwnProperty.call(prev, id)) base[id] = Boolean(prev[id]);
      });
      return base;
    });
  }

  const applyOverlayRendering = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) return;

    const sourceIdFor = (id: string) => `overlay-${id}`;
    const layerIdFor = (id: string) => `overlay-${id}-raster`;

    const remove = (id: string) => {
      const layerId = layerIdFor(id);
      const sourceId = sourceIdFor(id);
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore
      }
    };

    for (const overlay of overlays) {
      const visible = visibleOverlays[overlay.id] !== false;
      const corners = overlay.corners;
      const sourceId = sourceIdFor(overlay.id);
      const layerId = layerIdFor(overlay.id);

      if (!visible) {
        remove(overlay.id);
        continue;
      }

      if (!isValidCorners(corners)) {
        remove(overlay.id);
        continue;
      }

      const url = await getOverlaySignedUrl(supabase, { bucket: overlay.image_bucket, path: overlay.image_path, expiresInSeconds: 60 * 60 });

      if (map.getSource(sourceId)) {
        // Update opacity only
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "raster-opacity", overlay.opacity);
        }
        continue;
      }

      map.addSource(sourceId, {
        type: "image",
        url,
        coordinates: corners,
      } as any);

      map.addLayer({
        id: layerId,
        type: "raster",
        source: sourceId,
        paint: {
          "raster-opacity": overlay.opacity,
        },
      } as any);
    }
  }, [overlays, supabase, visibleOverlays]);

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

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: RGV_CENTER,
      zoom: 9,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      void applyOverlayRendering();
    });

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const handler = clickHandlerRef.current;
      if (handler) handler(e);
    };
    map.on("click", onClick);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [applyOverlayRendering]);

  useEffect(() => {
    void applyOverlayRendering();
  }, [applyOverlayRendering]);

  async function handleCreateOverlay() {
    if (!overlayName.trim()) {
      setStatus("Overlay name is required.");
      return;
    }

    const chosenUpload = selectedUploadId ? uploads.find((u) => u.id === selectedUploadId) ?? null : null;
    if (!chosenUpload && !newFile) {
      setStatus("Pick an existing upload, or choose a new file.");
      return;
    }

    setIsBusy(true);
    try {
      let uploadedRow: UploadedFileRow;
      let imageFile: File;
      let width: number | null = null;
      let height: number | null = null;

      if (chosenUpload) {
        uploadedRow = chosenUpload;
        const downloaded = await downloadUploadedFile(supabase, chosenUpload);
        if (downloaded.name.toLowerCase().endsWith(".pdf")) {
          const out = await pdfToPngFirstPage(downloaded);
          imageFile = out.png;
          width = out.width;
          height = out.height;
          uploadedRow = await uploadPlanningFile(supabase, { file: imageFile, notes: `Overlay image derived from ${chosenUpload.filename}` });
        } else {
          imageFile = downloaded;
          const size = await getImageSize(imageFile);
          width = size.width;
          height = size.height;
        }
      } else {
        const file = newFile as File;
        if (file.name.toLowerCase().endsWith(".pdf")) {
          const out = await pdfToPngFirstPage(file);
          imageFile = out.png;
          width = out.width;
          height = out.height;
        } else {
          imageFile = file;
          const size = await getImageSize(imageFile);
          width = size.width;
          height = size.height;
        }

        uploadedRow = await uploadPlanningFile(supabase, { file: imageFile, notes: "Overlay image" });
      }

      const overlay = await createMapOverlay(supabase, {
        name: overlayName,
        uploaded_file_id: uploadedRow.id,
        image_bucket: uploadedRow.bucket,
        image_path: uploadedRow.path,
        image_width: width,
        image_height: height,
        opacity: 0.6,
      });

      setStatus(`Created overlay: ${overlay.name}. Next: click “Place corners” and click 4 points on the map.`);
      setOverlayName("");
      setSelectedUploadId("");
      setNewFile(null);
      await reload();
      setSelectedOverlayId(overlay.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Create overlay failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteOverlay(row: MapOverlayRow) {
    const ok = window.confirm(`Delete overlay "${row.name}"?`);
    if (!ok) return;
    setIsBusy(true);
    try {
      await deleteMapOverlay(supabase, row.id);
      if (selectedOverlayId === row.id) setSelectedOverlayId("");
      await reload();
      setStatus("Deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  function startPlacingCorners() {
    if (!selectedOverlay) {
      setStatus("Select an overlay first.");
      return;
    }
    setCornerDraft([]);
    setIsPlacingCorners(true);
    setStatus("Click 4 corners on the map: top-left, top-right, bottom-right, bottom-left.");

    clickHandlerRef.current = (e) => {
      setCornerDraft((prev) => {
        const next = [...prev, [e.lngLat.lng, e.lngLat.lat] as [number, number]];
        if (next.length >= 4) {
          // stop capturing immediately
          clickHandlerRef.current = null;
          setIsPlacingCorners(false);
          const corners = next.slice(0, 4) as OverlayCorners;
          void (async () => {
            setIsBusy(true);
            try {
              await updateMapOverlayCorners(supabase, selectedOverlay.id, corners);
              await reload();
              setStatus("Corners saved.");
            } catch (error) {
              const message = error instanceof Error ? error.message : "Unknown error";
              setStatus(`Save corners failed: ${message}`);
            } finally {
              setIsBusy(false);
            }
          })();
        }
        return next;
      });
    };
  }

  async function clearCorners() {
    if (!selectedOverlay) return;
    setIsBusy(true);
    try {
      await updateMapOverlayCorners(supabase, selectedOverlay.id, null);
      await reload();
      setStatus("Corners cleared.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Clear failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function setOpacity(opacity: number) {
    if (!selectedOverlay) return;
    setIsBusy(true);
    try {
      await updateMapOverlayOpacity(supabase, selectedOverlay.id, opacity);
      await reload();
      setStatus("Opacity saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Opacity update failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-1 bg-slate-950 lg:grid-cols-[380px_1fr]">
      <aside className="z-10 h-[46vh] overflow-y-auto border-b border-white/10 bg-slate-900/95 p-4 lg:h-full lg:border-b-0 lg:border-r">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Map Overlays</h2>
        <p className="mt-1 text-xs text-slate-300">
          Planning-level alignment only. Use for rough visual reference, not survey-grade positioning.
        </p>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <label className="block text-xs font-semibold text-slate-200">Overlay name</label>
          <input
            value={overlayName}
            onChange={(e) => setOverlayName(e.target.value)}
            placeholder='Example: "1978 Utility Map"'
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
          />

          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-200">Use existing upload</label>
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

          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-200">Or upload a new file</label>
            <input
              type="file"
              accept={ACCEPT}
              disabled={isBusy}
              onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">Supported: PDF (page 1), PNG, JPG</p>
          </div>

          <button
            type="button"
            onClick={() => void handleCreateOverlay()}
            disabled={isBusy || !overlayName.trim()}
            className="mt-3 rounded-md border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
          >
            {isBusy ? "Working..." : "Create Overlay"}
          </button>
        </div>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Overlays</p>
          {overlays.length === 0 ? (
            <p className="mt-2 text-xs text-slate-300">No overlays yet.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {overlays.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/40 px-2 py-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedOverlayId(o.id)}
                    className={`min-w-0 flex-1 truncate text-left font-semibold ${selectedOverlayId === o.id ? "text-cyan-200" : "text-slate-100"}`}
                    title="Select overlay"
                  >
                    {o.name}
                  </button>
                  <input
                    type="checkbox"
                    checked={visibleOverlays[o.id] !== false}
                    onChange={() => setVisibleOverlays((prev) => ({ ...prev, [o.id]: !(prev[o.id] !== false) }))}
                    title="Show/hide"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDeleteOverlay(o)}
                    disabled={isBusy}
                    className="h-6 w-6 shrink-0 rounded border border-slate-600 bg-slate-900/40 text-sm font-semibold text-slate-200 hover:bg-slate-900 disabled:opacity-50"
                    aria-label={`Delete overlay ${o.name}`}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Selected Overlay</p>
          {!selectedOverlay ? (
            <p className="mt-2 text-xs text-slate-300">Select an overlay to place corners and adjust opacity.</p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-200">
                <span className="font-semibold">{selectedOverlay.name}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startPlacingCorners}
                  disabled={isBusy || isPlacingCorners}
                  className="rounded-md border border-cyan-600 bg-cyan-800/40 px-2 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
                >
                  {isPlacingCorners ? "Placing..." : "Place Corners"}
                </button>
                <button
                  type="button"
                  onClick={() => void clearCorners()}
                  disabled={isBusy}
                  className="rounded-md border border-slate-600 bg-slate-900/40 px-2 py-2 text-xs font-semibold text-slate-100 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Opacity</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedOverlay.opacity}
                  onChange={(e) => void setOpacity(Number(e.target.value))}
                  disabled={isBusy}
                  className="mt-2 w-full"
                />
              </div>

              <p className="text-xs text-slate-400">
                Corners: {isValidCorners(selectedOverlay.corners) ? "set" : "not set"}
                {cornerDraft.length > 0 ? ` (draft ${cornerDraft.length}/4)` : ""}
              </p>
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
