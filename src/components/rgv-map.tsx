"use client";

import type { Feature, Geometry, LineString } from "geojson";
import * as turf from "@turf/turf";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import maplibregl from "maplibre-gl";
import { Download, PencilRuler, PlusCircle, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteFeatureByExternalId, fetchFeatures, upsertFeature } from "@/lib/gis-api";
import { createDefaultProperties, ensureFeatureProperties, rowToGeoFeature, toGeoJson } from "@/lib/gis";
import { fetchImportedLayers, getImportedLayerGeojson } from "@/lib/imported-layers-api";
import { fetchMapOverlays, getOverlaySignedUrl, isValidCorners } from "@/lib/map-overlays-api";
import { createLayer, deleteLayerAndFeatures, ensureStarterLayers, fetchLayers } from "@/lib/layers-api";
import { fetchProjects } from "@/lib/projects-api";
import { createClient } from "@/lib/supabase/client";
import { FEATURE_PRIORITIES, type FeaturePriority, type FeatureProperties, type GisLayerRow, type LayerKey } from "@/types/gis";
import type { ProjectRow } from "@/types/phase2";
import type { ImportedLayerRow } from "@/types/phase3";
import type { MapOverlayRow } from "@/types/phase3";

const RGV_CENTER: [number, number] = [-97.7, 26.2];

function downloadText(filename: string, data: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildVisibility(layers: GisLayerRow[], value: boolean) {
  return layers.reduce((acc, layer) => {
    acc[layer.key] = value;
    return acc;
  }, {} as Record<string, boolean>);
}

export function RgvMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const [statusMessage, setStatusMessage] = useState("Loading map...");
  const [layers, setLayers] = useState<GisLayerRow[]>([]);
  const [projects, setProjects] = useState<Array<Pick<ProjectRow, "id" | "name">>>([]);
  const [importedLayers, setImportedLayers] = useState<ImportedLayerRow[]>([]);
  const [mapOverlays, setMapOverlays] = useState<MapOverlayRow[]>([]);
  const [activeLayer, setActiveLayer] = useState<LayerKey>("desal_plant");
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({});
  const [visibleImportedLayers, setVisibleImportedLayers] = useState<Record<string, boolean>>({});
  const [visibleMapOverlays, setVisibleMapOverlays] = useState<Record<string, boolean>>({});
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [selectedProperties, setSelectedProperties] = useState<FeatureProperties | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [persistedExternalIds, setPersistedExternalIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [drawMode, setDrawMode] = useState<string>("simple_select");
  const [drawVersion, setDrawVersion] = useState(0);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const activeLayerRef = useRef<LayerKey>("desal_plant");
  const visibleLayersRef = useRef<Record<string, boolean>>({});
  const visibleImportedLayersRef = useRef<Record<string, boolean>>({});
  const visibleMapOverlaysRef = useRef<Record<string, boolean>>({});
  const selectedFeatureIdRef = useRef<string | null>(null);
  const layersByKeyRef = useRef<Map<string, GisLayerRow>>(new Map());
  const importedGeojsonCacheRef = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());
  const knownImportedLayerIdsRef = useRef<Set<string>>(new Set());
  const knownOverlayIdsRef = useRef<Set<string>>(new Set());
  const overlayUrlCacheRef = useRef<Map<string, string>>(new Map());

  const [isAddingLayer, setIsAddingLayer] = useState(false);
  const [newLayerLabel, setNewLayerLabel] = useState("");

  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);

  useEffect(() => {
    visibleLayersRef.current = visibleLayers;
  }, [visibleLayers]);

  useEffect(() => {
    visibleImportedLayersRef.current = visibleImportedLayers;
  }, [visibleImportedLayers]);

  useEffect(() => {
    visibleMapOverlaysRef.current = visibleMapOverlays;
  }, [visibleMapOverlays]);

  useEffect(() => {
    layersByKeyRef.current = new Map(layers.map((layer) => [layer.key, layer]));
  }, [layers]);

  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;

    // If a layer color changes (or layers are added), refresh feature colors.
    (draw.getAll().features as Array<Feature<Geometry>>).forEach((feature) => {
      const fid = String(feature.id);
      const props = ensureFeatureProperties(feature);
      const color = layersByKeyRef.current.get(props.layer_key)?.color ?? "#3bb2d0";
      draw.setFeatureProperty(fid, "color", color);
    });

    setDrawVersion((prev) => prev + 1);
  }, [layers]);

  const refreshLayers = useCallback(async () => {
    try {
      await ensureStarterLayers(supabase);
      const next = await fetchLayers(supabase);
      setLayers(next);

      setVisibleLayers((prev) => {
        const base = next.length > 0 ? buildVisibility(next, true) : {};
        // Preserve user toggles if keys still exist.
        Object.keys(base).forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(prev, key)) {
            base[key] = Boolean(prev[key]);
          }
        });
        return base;
      });

      if (next.length > 0 && !next.some((layer) => layer.key === activeLayerRef.current)) {
        setActiveLayer(next[0].key);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Layers failed to load: ${message}. Run the updated Supabase schema.sql.`);
    }
  }, [supabase]);

  useEffect(() => {
    void refreshLayers();
  }, [refreshLayers]);

  useEffect(() => {
    (async () => {
      try {
        const next = await fetchProjects(supabase);
        setProjects(next.map((row) => ({ id: row.id, name: row.name })));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatusMessage(`Projects failed to load: ${message}. Run supabase/phase2.sql.`);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      try {
        const next = await fetchImportedLayers(supabase);
        setImportedLayers(next);
        setVisibleImportedLayers((prev) => {
          const base = next.reduce((acc, row) => {
            acc[row.id] = row.default_visible;
            return acc;
          }, {} as Record<string, boolean>);

          Object.keys(base).forEach((id) => {
            if (Object.prototype.hasOwnProperty.call(prev, id)) {
              base[id] = Boolean(prev[id]);
            }
          });

          return base;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatusMessage(`Imported layers failed to load: ${message}. Run supabase/phase3.sql.`);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      try {
        const next = await fetchMapOverlays(supabase);
        setMapOverlays(next);
        setVisibleMapOverlays((prev) => {
          const base = next.reduce((acc, row) => {
            acc[row.id] = true;
            return acc;
          }, {} as Record<string, boolean>);
          Object.keys(base).forEach((id) => {
            if (Object.prototype.hasOwnProperty.call(prev, id)) base[id] = Boolean(prev[id]);
          });
          return base;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatusMessage(`Map overlays failed to load: ${message}. Run supabase/phase3.sql.`);
      }
    })();
  }, [supabase]);

  const applyImportedLayerVisibility = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    if (!map.isStyleLoaded()) return;

    const sourceIdFor = (id: string) => `imported-${id}`;
    const fillIdFor = (id: string) => `imported-${id}-fill`;
    const lineIdFor = (id: string) => `imported-${id}-line`;
    const pointIdFor = (id: string) => `imported-${id}-point`;

    const remove = (id: string) => {
      const fillId = fillIdFor(id);
      const lineId = lineIdFor(id);
      const pointId = pointIdFor(id);
      const sourceId = sourceIdFor(id);

      try {
        if (map.getLayer(fillId)) map.removeLayer(fillId);
        if (map.getLayer(lineId)) map.removeLayer(lineId);
        if (map.getLayer(pointId)) map.removeLayer(pointId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore
      }
    };

    // Clean up any removed imported layer ids.
    const nextIds = new Set(importedLayers.map((l) => l.id));
    for (const prevId of knownImportedLayerIdsRef.current) {
      if (!nextIds.has(prevId)) {
        remove(prevId);
        importedGeojsonCacheRef.current.delete(prevId);
      }
    }
    knownImportedLayerIdsRef.current = nextIds;

    for (const layer of importedLayers) {
      const visible = visibleImportedLayersRef.current[layer.id] !== false;
      const sourceId = sourceIdFor(layer.id);

      if (!visible) {
        remove(layer.id);
        continue;
      }

      if (map.getSource(sourceId)) {
        continue;
      }

      let fc = importedGeojsonCacheRef.current.get(layer.id);
      if (!fc) {
        fc = await getImportedLayerGeojson(supabase, layer.id);
        importedGeojsonCacheRef.current.set(layer.id, fc);
      }

      map.addSource(sourceId, {
        type: "geojson",
        data: fc,
      } as any);

      // Polygon fill
      map.addLayer({
        id: fillIdFor(layer.id),
        type: "fill",
        source: sourceId,
        filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
        paint: {
          "fill-color": "#3bb2d0",
          "fill-opacity": 0.12,
          "fill-outline-color": "#3bb2d0",
        },
      } as any);

      // Lines
      map.addLayer({
        id: lineIdFor(layer.id),
        type: "line",
        source: sourceId,
        filter: [
          "any",
          ["==", ["geometry-type"], "LineString"],
          ["==", ["geometry-type"], "MultiLineString"],
          ["==", ["geometry-type"], "Polygon"],
          ["==", ["geometry-type"], "MultiPolygon"],
        ],
        paint: {
          "line-color": "#3bb2d0",
          "line-width": 2,
        },
      } as any);

      // Points
      map.addLayer({
        id: pointIdFor(layer.id),
        type: "circle",
        source: sourceId,
        filter: ["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]],
        paint: {
          "circle-radius": 4,
          "circle-color": "#3bb2d0",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      } as any);
    }
  }, [importedLayers, isMapLoaded, supabase]);

  const applyMapOverlayVisibility = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
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

    const nextIds = new Set(mapOverlays.map((o) => o.id));
    for (const prevId of knownOverlayIdsRef.current) {
      if (!nextIds.has(prevId)) {
        remove(prevId);
        overlayUrlCacheRef.current.delete(prevId);
      }
    }
    knownOverlayIdsRef.current = nextIds;

    for (const overlay of mapOverlays) {
      const visible = visibleMapOverlaysRef.current[overlay.id] !== false;
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

      if (map.getSource(sourceId)) {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "raster-opacity", overlay.opacity);
        }
        continue;
      }

      let url = overlayUrlCacheRef.current.get(overlay.id);
      if (!url) {
        url = await getOverlaySignedUrl(supabase, { bucket: overlay.image_bucket, path: overlay.image_path, expiresInSeconds: 60 * 60 });
        overlayUrlCacheRef.current.set(overlay.id, url);
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
  }, [isMapLoaded, mapOverlays, supabase]);

  useEffect(() => {
    selectedFeatureIdRef.current = selectedFeatureId;
  }, [selectedFeatureId]);

  const applyLayerVisibility = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;

    const selectedId = selectedFeatureIdRef.current;
    let selectedIsHidden = false;
    const anyVisible = Object.values(visibleLayersRef.current).some(Boolean);

    const all = draw.getAll();
    all.features.forEach((feature) => {
      const fid = String(feature.id);
      const props = ensureFeatureProperties(feature as Feature<Geometry>);
      const layerVisible = visibleLayersRef.current[props.layer_key];
      const isHidden = layerVisible === false;
      // With MapboxDraw `userProperties: true`, the user prop `hidden`
      // is exposed to the style layer as `user_hidden`.
      draw.setFeatureProperty(fid, "hidden", isHidden);
      if (selectedId && fid === selectedId && isHidden) {
        selectedIsHidden = true;
      }
    });

    // If nothing is visible (or the selected feature was just hidden), clear selection
    // and return to simple_select to avoid lingering vertex/handle UI.
    if (!anyVisible || selectedIsHidden) {
      selectedFeatureIdRef.current = null;
      setSelectedFeatureId(null);
      setSelectedProperties(null);
      setDistanceMiles(null);
      try {
        (draw as unknown as { changeMode: (value: string) => void }).changeMode("simple_select");
      } catch {
        // ignore
      }
    }
  }, []);

  function focusLayer(layerKey: LayerKey) {
    // The dropdown is the primary "what am I working on" control.
    // When you switch layers, we focus the map to that layer by default.
    setActiveLayer(layerKey);
    const nextVisibility = (() => {
      const next = buildVisibility(layers, false);
      next[layerKey] = true;
      return next;
    })();
    visibleLayersRef.current = nextVisibility;
    setVisibleLayers(nextVisibility);
    // Make the change feel instant (don't wait on React effect timing).
    queueMicrotask(() => applyLayerVisibility());

    // Clear selection/details if it isn't in the newly focused layer.
    const draw = drawRef.current;
    const selectedId = selectedFeatureIdRef.current;
    if (draw && selectedId) {
      const current = draw.get(selectedId) as Feature<Geometry> | undefined;
      if (!current || ensureFeatureProperties(current).layer_key !== layerKey) {
        selectedFeatureIdRef.current = null;
        setSelectedFeatureId(null);
        setSelectedProperties(null);
        setDistanceMiles(null);
        try {
          (draw as unknown as { changeMode: (value: string) => void }).changeMode("simple_select");
        } catch {
          // ignore
        }
      }
    }

    const label = layersByKeyRef.current.get(layerKey)?.label ?? layerKey;
    setStatusMessage(`Focused on: ${label}`);
  }

  async function handleCreateLayer() {
    try {
      const created = await createLayer(supabase, { label: newLayerLabel });
      setNewLayerLabel("");
      setIsAddingLayer(false);
      await refreshLayers();
      focusLayer(created.key);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Create layer failed: ${message}`);
    }
  }

  async function handleDeleteActiveLayer() {
    if (layers.length === 0) return;
    if (layers.length === 1) {
      setStatusMessage("You need at least one layer. Add a new layer first, then delete this one.");
      return;
    }
    await handleDeleteLayer(activeLayerRef.current);
  }

  async function handleDeleteLayer(key: string) {
    const label = layersByKeyRef.current.get(key)?.label ?? key;
    if (layers.length <= 1) {
      setStatusMessage("You need at least one layer. Add a new layer first, then delete this one.");
      return;
    }

    const ok = window.confirm(`Delete layer "${label}"? (Its items will be removed too.)`);
    if (!ok) return;

    try {
      await deleteLayerAndFeatures(supabase, key);
      await refreshLayers();
      await reloadFromSupabase();
      setStatusMessage(`Deleted layer: ${label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Delete layer failed: ${message}`);
    }
  }

  const reloadFromSupabase = useCallback(async () => {
    const draw = drawRef.current;
    if (!draw) return;

    const rows = await fetchFeatures(supabase);
    const features = rows.map(rowToGeoFeature);

    draw.deleteAll();
    if (features.length > 0) {
      draw.add(toGeoJson(features));
    }

    // Apply per-layer colors from the current layer list.
    (draw.getAll().features as Array<Feature<Geometry>>).forEach((feature) => {
      const fid = String(feature.id);
      const props = ensureFeatureProperties(feature);
      const color = layersByKeyRef.current.get(props.layer_key)?.color ?? "#3bb2d0";
      draw.setFeatureProperty(fid, "color", color);
    });

    setPersistedExternalIds(new Set(features.map((feature) => feature.properties.external_id)));
    selectedFeatureIdRef.current = null;
    setSelectedFeatureId(null);
    applyLayerVisibility();
    setDrawVersion((prev) => prev + 1);
    setStatusMessage(
      features.length > 0
        ? `Loaded ${features.length} feature(s) from Supabase.`
        : "No features yet. Click Load Starter Data, or draw Point/Line and click Save.",
    );
  }, [applyLayerVisibility, supabase]);

  const refreshSelection = useCallback(() => {
    const draw = drawRef.current;
    const currentSelectedId = selectedFeatureIdRef.current;

    if (!draw || !currentSelectedId) {
      setSelectedProperties(null);
      setDistanceMiles(null);
      return;
    }

    const feature = draw.get(currentSelectedId) as Feature<Geometry> | undefined;

    if (!feature) {
      setSelectedFeatureId(null);
      setSelectedProperties(null);
      setDistanceMiles(null);
      return;
    }

    const props = ensureFeatureProperties(feature);
    setSelectedProperties(props);

    if (feature.geometry.type === "LineString") {
      const miles = turf.length(feature as Feature<LineString>, { units: "miles" });
      setDistanceMiles(Number(miles.toFixed(2)));
    } else {
      setDistanceMiles(null);
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Mapbox Draw expects mapboxgl-compatible APIs; maplibre works with this assignment.
    (globalThis as unknown as { mapboxgl: typeof maplibregl }).mapboxgl = maplibregl;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: RGV_CENTER,
      zoom: 8,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    // MapboxDraw 1.5.1 default styles use expression-based line-dasharray which
    // MapLibre does not support (line-dasharray is not data-drivable in MapLibre).
    // We supply the full set of Draw styles with literal dasharray values instead.
    const FEATURE_COLOR_EXPR = ["coalesce", ["get", "user_color"], "#3bb2d0"] as unknown as string[];

    const DRAW_STYLES = [
      // Polygon fill
      { id: "gl-draw-polygon-fill-inactive", type: "fill", filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"], ["!=", "mode", "static"], ["!=", "user_hidden", true], ["!=", "hidden", true]], paint: { "fill-color": "#3bb2d0", "fill-outline-color": "#3bb2d0", "fill-opacity": 0.1 } },
      { id: "gl-draw-polygon-fill-active", type: "fill", filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"], ["!=", "user_hidden", true], ["!=", "hidden", true]], paint: { "fill-color": "#fbb03b", "fill-outline-color": "#fbb03b", "fill-opacity": 0.1 } },
      // Midpoints
      { id: "gl-draw-polygon-midpoint", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]], paint: { "circle-radius": 3, "circle-color": "#fbb03b" } },
      // Polygon stroke
      { id: "gl-draw-polygon-stroke-inactive", type: "line", filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"], ["!=", "mode", "static"], ["!=", "user_hidden", true], ["!=", "hidden", true]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#3bb2d0", "line-width": 2 } },
      { id: "gl-draw-polygon-stroke-active", type: "line", filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"], ["!=", "user_hidden", true], ["!=", "hidden", true]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fbb03b", "line-dasharray": [0.5, 4.5], "line-width": 2 } },
      // Lines
      {
        id: "gl-draw-line-inactive",
        type: "line",
        filter: ["all", ["==", "active", "false"], ["==", "$type", "LineString"], ["!=", "mode", "static"], ["!=", "user_hidden", true], ["!=", "hidden", true]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": FEATURE_COLOR_EXPR, "line-width": 3 },
      },
      {
        id: "gl-draw-line-active",
        type: "line",
        filter: ["all", ["==", "active", "true"], ["==", "$type", "LineString"], ["!=", "user_hidden", true], ["!=", "hidden", true]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": FEATURE_COLOR_EXPR, "line-dasharray": [0.5, 4.5], "line-width": 3 },
      },
      // Vertex halos & points
      { id: "gl-draw-polygon-and-line-vertex-halo-inactive", type: "circle", filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]], paint: { "circle-radius": 5, "circle-color": "#fff" } },
      { id: "gl-draw-polygon-and-line-vertex-inactive", type: "circle", filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]], paint: { "circle-radius": 3, "circle-color": "#fbb03b" } },
      // Points - inactive
      { id: "gl-draw-point-point-stroke-inactive", type: "circle", filter: ["all", ["==", "active", "false"], ["==", "$type", "Point"], ["==", "meta", "feature"], ["!=", "mode", "static"], ["!=", "user_hidden", true], ["!=", "hidden", true]], paint: { "circle-radius": 6, "circle-opacity": 1, "circle-color": "#fff" } },
      { id: "gl-draw-point-inactive", type: "circle", filter: ["all", ["==", "active", "false"], ["==", "$type", "Point"], ["==", "meta", "feature"], ["!=", "mode", "static"], ["!=", "user_hidden", true], ["!=", "hidden", true]], paint: { "circle-radius": 4, "circle-color": FEATURE_COLOR_EXPR } },
      // Points - active
      { id: "gl-draw-point-stroke-active", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "active", "true"], ["!=", "meta", "midpoint"], ["!=", "user_hidden", true], ["!=", "hidden", true]], paint: { "circle-radius": 8, "circle-color": "#fff" } },
      { id: "gl-draw-point-active", type: "circle", filter: ["all", ["==", "$type", "Point"], ["!=", "meta", "midpoint"], ["==", "active", "true"], ["!=", "user_hidden", true], ["!=", "hidden", true]], paint: { "circle-radius": 6, "circle-color": FEATURE_COLOR_EXPR } },
      // Static mode
      { id: "gl-draw-polygon-fill-static", type: "fill", filter: ["all", ["==", "mode", "static"], ["==", "$type", "Polygon"], ["!=", "user_hidden", true], ["!=", "hidden", true]], paint: { "fill-color": "#404040", "fill-outline-color": "#404040", "fill-opacity": 0.1 } },
      { id: "gl-draw-polygon-stroke-static", type: "line", filter: ["all", ["==", "mode", "static"], ["==", "$type", "Polygon"], ["!=", "user_hidden", true], ["!=", "hidden", true]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#404040", "line-width": 2 } },
      { id: "gl-draw-line-static", type: "line", filter: ["all", ["==", "mode", "static"], ["==", "$type", "LineString"], ["!=", "user_hidden", true], ["!=", "hidden", true]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": FEATURE_COLOR_EXPR, "line-width": 3 } },
      { id: "gl-draw-point-static", type: "circle", filter: ["all", ["==", "mode", "static"], ["==", "$type", "Point"], ["!=", "user_hidden", true], ["!=", "hidden", true]], paint: { "circle-radius": 5, "circle-color": FEATURE_COLOR_EXPR } },
    ] as object[];

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { point: true, line_string: true, trash: true },
      // Required so feature properties (hidden/color/etc) are available to style filters/expressions.
      userProperties: true,
      styles: DRAW_STYLES,
    });

    mapRef.current = map;
    drawRef.current = draw;

    map.addControl(draw as unknown as maplibregl.IControl, "top-left");

    map.on("load", async () => {
      try {
        setIsMapLoaded(true);
        await reloadFromSupabase();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatusMessage(`Map loaded. Supabase load failed: ${message}`);
      }
    });

    map.on("draw.create", (event: { features: Array<Feature<Geometry> & { id: string }> }) => {
      event.features.forEach((feature) => {
        const props = createDefaultProperties(activeLayerRef.current);
        const fid = String(feature.id);
        Object.entries(props).forEach(([key, value]) => {
          draw.setFeatureProperty(fid, key, value);
        });

        const color = layersByKeyRef.current.get(props.layer_key)?.color ?? "#3bb2d0";
        draw.setFeatureProperty(fid, "color", color);
      });
      setDrawMode("simple_select");
      applyLayerVisibility();
      const newSelection = String(event.features[0]?.id ?? "");
      selectedFeatureIdRef.current = newSelection;
      setSelectedFeatureId(newSelection);
      setDrawVersion((prev) => prev + 1);
      setStatusMessage("✓ Feature placed. Fill in the details below, then click Save.");
    });

    map.on("draw.update", () => {
      refreshSelection();
      setDrawVersion((prev) => prev + 1);
      setStatusMessage("Feature moved. Click Save to persist.");
    });

    map.on("draw.selectionchange", (event: { features: Array<Feature<Geometry> & { id: string }> }) => {
      const selected = event.features[0];
      const selectedId = selected ? String(selected.id) : null;
      selectedFeatureIdRef.current = selectedId;
      setSelectedFeatureId(selectedId);
    });

    map.on("draw.delete", () => {
      selectedFeatureIdRef.current = null;
      setSelectedFeatureId(null);
      setDrawVersion((prev) => prev + 1);
      setStatusMessage("Feature removed from map. Click Save to sync.");
    });

    map.on("draw.modechange", (event: { mode: string }) => {
      setDrawMode(event.mode);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      setIsMapLoaded(false);
    };
  }, [applyLayerVisibility, refreshSelection, reloadFromSupabase]);

  useEffect(() => {
    void applyImportedLayerVisibility();
  }, [applyImportedLayerVisibility, visibleImportedLayers]);

  useEffect(() => {
    void applyMapOverlayVisibility();
  }, [applyMapOverlayVisibility, visibleMapOverlays]);

  const projectNameById = useMemo(() => {
    return new Map(projects.map((row) => [row.id, row.name] as const));
  }, [projects]);

  useEffect(() => {
    applyLayerVisibility();
    refreshSelection();
    setDrawVersion((prev) => prev + 1);
  }, [applyLayerVisibility, refreshSelection, visibleLayers, selectedFeatureId]);

  const activeLayerFeatures = useMemo(() => {
    const draw = drawRef.current;
    if (!draw) return [] as Array<{ id: string; title: string; geometryType: string; hidden: boolean; projectName: string }>;

    return (draw.getAll().features as Array<Feature<Geometry>>)
      .map((feature) => {
        const props = ensureFeatureProperties(feature);
        const projectId = (props.project_id ?? "").trim();
        const projectName = projectId.length > 0 ? projectNameById.get(projectId) ?? "" : "";
        return {
          id: String(feature.id),
          title: props.title.trim() ? props.title.trim() : "(untitled)",
          geometryType: feature.geometry.type,
          hidden: Boolean(props.hidden),
          projectName,
          layerKey: props.layer_key,
        };
      })
      .filter((row) => row.layerKey === activeLayer)
      .map(({ layerKey: _layerKey, ...rest }) => rest);
  }, [activeLayer, drawVersion, projectNameById]);

  function deleteFeatureFromMap(featureId: string) {
    const draw = drawRef.current;
    if (!draw) return;

    const ok = window.confirm("Remove this item from the map? (Click Save to sync.)");
    if (!ok) return;

    try {
      draw.delete(featureId);
    } catch {
      // ignore
    }

    if (selectedFeatureIdRef.current === featureId) {
      selectedFeatureIdRef.current = null;
      setSelectedFeatureId(null);
      setSelectedProperties(null);
      setDistanceMiles(null);
    }

    setDrawVersion((prev) => prev + 1);
    setStatusMessage("Item removed from map. Click Save to sync to Supabase.");
  }

  function focusFeature(featureId: string) {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;

    const feature = draw.get(featureId) as Feature<Geometry> | undefined;
    if (!feature) return;

    selectedFeatureIdRef.current = featureId;
    setSelectedFeatureId(featureId);
    (draw as unknown as { changeMode: (value: string, options?: unknown) => void }).changeMode("simple_select", {
      featureIds: [featureId],
    });

    try {
      if (feature.geometry.type === "Point") {
        const coords = (feature.geometry.coordinates as [number, number]) ?? RGV_CENTER;
        map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 12) });
      } else {
        const bbox = turf.bbox(feature as unknown as turf.AllGeoJSON) as [number, number, number, number];
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 80, duration: 300 },
        );
      }
    } catch {
      // ignore camera errors
    }
  }

  function updateSelectedProperty(key: keyof FeatureProperties, value: string | boolean) {
    const draw = drawRef.current;
    if (!draw || !selectedFeatureId || !selectedProperties) return;

    draw.setFeatureProperty(selectedFeatureId, key, value);
    setSelectedProperties((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: value,
      };
    });
  }

  function changeSelectedLayer(nextLayerKey: string) {
    const draw = drawRef.current;
    if (!draw || !selectedFeatureId) return;

    draw.setFeatureProperty(selectedFeatureId, "layer_key", nextLayerKey);
    const color = layersByKeyRef.current.get(nextLayerKey)?.color ?? "#3bb2d0";
    draw.setFeatureProperty(selectedFeatureId, "color", color);

    setSelectedProperties((prev) => (prev ? { ...prev, layer_key: nextLayerKey } : prev));
    applyLayerVisibility();
    setDrawVersion((prev) => prev + 1);
  }

  function setMode(mode: "draw_point" | "draw_line_string" | "simple_select") {
    const draw = drawRef.current;
    if (!draw) return;
    (draw as unknown as { changeMode: (value: string) => void }).changeMode(mode);
    setDrawMode(mode);
  }

  function quickPlace(layer: LayerKey, mode: "draw_point" | "draw_line_string") {
    setActiveLayer(layer);
    setMode(mode);
    setStatusMessage(
      mode === "draw_point"
        ? "Step 2: click once on the map to place it. Then fill details and click Save."
        : "Step 2: click to add line points and double-click to finish. Then click Save.",
    );
  }

  async function saveToSupabase() {
    const draw = drawRef.current;
    if (!draw) return;

    const all = draw.getAll().features as Array<Feature<Geometry>>;
    setIsSaving(true);

    try {
      const normalized = all.map((feature) => ({
        ...feature,
        properties: ensureFeatureProperties(feature),
      })) as Array<Feature<Geometry, FeatureProperties>>;

      for (const feature of normalized) {
        await upsertFeature(supabase, feature);
      }

      const currentExternalIds = new Set(normalized.map((feature) => feature.properties.external_id));

      for (const externalId of persistedExternalIds) {
        if (!currentExternalIds.has(externalId)) {
          await deleteFeatureByExternalId(supabase, externalId);
        }
      }

      setPersistedExternalIds(currentExternalIds);
      setStatusMessage(`Saved ${normalized.length} feature(s) to Supabase.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Save failed: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function exportGeoJson() {
    const draw = drawRef.current;
    if (!draw) return;

    const normalized = (draw.getAll().features as Array<Feature<Geometry>>).map((feature) => ({
      ...feature,
      properties: ensureFeatureProperties(feature),
    })) as Array<Feature<Geometry, FeatureProperties>>;

    const geojson = JSON.stringify(toGeoJson(normalized), null, 2);
    downloadText("rgv-water-gis-export.geojson", geojson, "application/geo+json");
    setStatusMessage("GeoJSON export complete.");
  }

  return (
    <div className="grid h-full grid-cols-1 bg-slate-950 lg:grid-cols-[360px_1fr]">
      <aside className="z-10 h-[46vh] overflow-y-auto border-b border-white/10 bg-slate-900/95 p-4 lg:h-full lg:border-b-0 lg:border-r">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Layer Controls</h2>
          <label className="block text-xs text-slate-300">Choose a layer (what you are adding/editing)</label>
          <select
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            value={activeLayer}
            onChange={(event) => focusLayer(event.target.value as LayerKey)}
          >
            {layers.map((layer) => (
              <option key={layer.key} value={layer.key}>
                {layer.label}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingLayer((prev) => !prev)}
              className="rounded-md border border-cyan-600 bg-cyan-800/30 px-2 py-2 text-xs font-semibold text-cyan-100"
            >
              Add Layer
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteActiveLayer()}
              disabled={layers.length <= 1}
              className="rounded-md border border-rose-600 bg-rose-800/30 px-2 py-2 text-xs font-semibold text-rose-100 disabled:opacity-40"
            >
              Delete Layer
            </button>
          </div>

          {isAddingLayer ? (
            <div className="rounded border border-slate-700 bg-slate-950/40 p-2">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                New layer name
              </label>
              <input
                value={newLayerLabel}
                onChange={(event) => setNewLayerLabel(event.target.value)}
                placeholder='Example: "Home"'
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingLayer(false);
                    setNewLayerLabel("");
                  }}
                  className="rounded-md border border-slate-600 bg-slate-900/40 px-2 py-2 text-xs font-semibold text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateLayer()}
                  disabled={!newLayerLabel.trim()}
                  className="rounded-md border border-cyan-600 bg-cyan-800/40 px-2 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-1 pt-1">
            {layers.map((layer) => (
              <div key={layer.key} className="flex items-center justify-between gap-2 rounded border border-slate-700 px-2 py-1.5 text-xs">
                <label className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibleLayers[layer.key] !== false}
                    onChange={() =>
                      setVisibleLayers((prev) => ({
                        ...prev,
                        [layer.key]: !(prev[layer.key] !== false),
                      }))
                    }
                  />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: layer.color }} />
                  <span className="truncate font-semibold text-slate-100">{layer.label}</span>
                </label>

                <button
                  type="button"
                  onClick={() => void handleDeleteLayer(layer.key)}
                  className="h-6 w-6 shrink-0 rounded border border-slate-600 bg-slate-900/40 text-sm font-semibold text-slate-200 hover:bg-slate-900"
                  aria-label={`Delete layer ${layer.label}`}
                  title="Delete layer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Imported Layers</p>
          {importedLayers.length === 0 ? (
            <p className="mt-2 text-xs text-slate-300">No imported layers yet. Add one under Planning Tools → Imported Layers.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {importedLayers.map((layer) => (
                <label
                  key={layer.id}
                  className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/40 px-2 py-1.5 text-xs"
                >
                  <span className="min-w-0 truncate font-semibold text-slate-100">{layer.name}</span>
                  <input
                    type="checkbox"
                    checked={visibleImportedLayers[layer.id] !== false}
                    onChange={() =>
                      setVisibleImportedLayers((prev) => ({
                        ...prev,
                        [layer.id]: !(prev[layer.id] !== false),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-300">Imported layers are read-only overlays (planning reference).</p>
        </div>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Map Overlays</p>
          {mapOverlays.length === 0 ? (
            <p className="mt-2 text-xs text-slate-300">No overlays yet. Create one under Planning Tools → Map Overlays.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {mapOverlays.map((overlay) => (
                <label
                  key={overlay.id}
                  className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/40 px-2 py-1.5 text-xs"
                  title={isValidCorners(overlay.corners) ? "" : "Overlay needs corners set"}
                >
                  <span className="min-w-0 truncate font-semibold text-slate-100">
                    {overlay.name}
                    {!isValidCorners(overlay.corners) ? <span className="ml-2 text-slate-400">(set corners)</span> : null}
                  </span>
                  <input
                    type="checkbox"
                    checked={visibleMapOverlays[overlay.id] !== false}
                    onChange={() =>
                      setVisibleMapOverlays((prev) => ({
                        ...prev,
                        [overlay.id]: !(prev[overlay.id] !== false),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-300">Overlays are planning-level reference only.</p>
        </div>

        <div className="mt-4 rounded border border-white/10 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Items In Selected Layer</p>
          {activeLayerFeatures.length === 0 ? (
            <p className="mt-2 text-xs text-slate-300">No items yet. Use Point or Line, then Save.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {activeLayerFeatures.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/40 px-2 py-1.5 text-left text-xs"
                >
                  <button
                    type="button"
                    onClick={() => focusFeature(row.id)}
                    className="min-w-0 flex-1 text-left hover:underline"
                    title="Select + zoom"
                  >
                    <span className="font-semibold text-slate-100">{row.title}</span>
                    <span className="ml-2 text-slate-400">({row.geometryType}{row.hidden ? ", hidden" : ""})</span>
                    {row.projectName ? <span className="ml-2 text-slate-400">· {row.projectName}</span> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFeatureFromMap(row.id)}
                    className="h-6 w-6 shrink-0 rounded border border-slate-600 bg-slate-900/40 text-sm font-semibold text-slate-200 hover:bg-slate-900"
                    aria-label="Remove item"
                    title="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-300">
            Edit: click an item above (or click on the map), drag to move, then click Save. Delete: click ×, then Save.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("draw_point")}
            className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition-colors ${drawMode === "draw_point" ? "border-cyan-400 bg-cyan-600 text-white" : "border-slate-500 bg-slate-800"}`}
          >
            <PlusCircle className="h-3.5 w-3.5" /> Point
          </button>
          <button
            type="button"
            onClick={() => setMode("draw_line_string")}
            className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition-colors ${drawMode === "draw_line_string" ? "border-cyan-400 bg-cyan-600 text-white" : "border-slate-500 bg-slate-800"}`}
          >
            <PencilRuler className="h-3.5 w-3.5" /> Line
          </button>
          <button
            type="button"
            onClick={saveToSupabase}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-teal-500 bg-teal-700 px-2 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={exportGeoJson}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-sky-500 bg-sky-700 px-2 py-2 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" /> GeoJSON
          </button>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Feature Details</h3>
          {!selectedProperties ? (
            <p className="mt-2 text-xs text-slate-300">Select a feature to edit metadata and route details.</p>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Layer</label>
                <select
                  value={selectedProperties.layer_key}
                  onChange={(event) => changeSelectedLayer(event.target.value)}
                  className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
                >
                  {layers.map((layer) => (
                    <option key={layer.key} value={layer.key}>
                      {layer.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Project</label>
                <select
                  value={selectedProperties.project_id ?? ""}
                  onChange={(event) => updateSelectedProperty("project_id", event.target.value)}
                  className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
                >
                  <option value="">None</option>
                  {selectedProperties.project_id &&
                  selectedProperties.project_id.length > 0 &&
                  !projects.some((p) => p.id === selectedProperties.project_id) ? (
                    <option value={selectedProperties.project_id}>Unknown project</option>
                  ) : null}
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <input
                value={selectedProperties.title}
                onChange={(event) => updateSelectedProperty("title", event.target.value)}
                placeholder="Feature title"
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
              />
              <textarea
                value={selectedProperties.notes}
                onChange={(event) => updateSelectedProperty("notes", event.target.value)}
                placeholder="Notes"
                className="h-16 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
              />

              <input
                value={selectedProperties.estimated_cost ?? ""}
                onChange={(event) => updateSelectedProperty("estimated_cost", event.target.value)}
                placeholder="Estimated construction cost (USD)"
                inputMode="decimal"
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
              />
              <select
                value={selectedProperties.priority}
                onChange={(event) => updateSelectedProperty("priority", event.target.value as FeaturePriority)}
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
              >
                {FEATURE_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.toUpperCase()}
                  </option>
                ))}
              </select>
              <input
                value={selectedProperties.contact_name}
                onChange={(event) => updateSelectedProperty("contact_name", event.target.value)}
                placeholder="Contact name"
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
              />
              <input
                value={selectedProperties.contact_phone}
                onChange={(event) => updateSelectedProperty("contact_phone", event.target.value)}
                placeholder="Phone"
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
              />
              <input
                value={selectedProperties.contact_email}
                onChange={(event) => updateSelectedProperty("contact_email", event.target.value)}
                placeholder="Email"
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
              />
              <input
                value={selectedProperties.source_url}
                onChange={(event) => updateSelectedProperty("source_url", event.target.value)}
                placeholder="Source URL"
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs"
              />
              {distanceMiles !== null ? (
                <p className="rounded bg-slate-800 px-2 py-1.5 text-xs text-teal-300">Route distance: {distanceMiles} miles</p>
              ) : null}
            </div>
          )}
        </div>

        <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-300">{statusMessage}</p>
        {drawMode === "draw_point" && (
          <p className="mt-1 rounded border border-cyan-700 bg-cyan-950 p-2 text-xs text-cyan-300">
            📍 Point mode — click anywhere on the map to place a point.
          </p>
        )}
        {drawMode === "draw_line_string" && (
          <p className="mt-1 rounded border border-cyan-700 bg-cyan-950 p-2 text-xs text-cyan-300">
            📏 Line mode — click to add points. Double-click the last point to finish.
          </p>
        )}
      </aside>

      <section className="relative h-[54vh] lg:h-full">
        <div ref={mapContainerRef} className="h-full w-full" />
      </section>
    </div>
  );
}
