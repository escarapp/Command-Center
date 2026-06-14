import type { Feature, FeatureCollection, Geometry, LineString, Point } from "geojson";
import Papa from "papaparse";
import { FEATURE_PRIORITIES, type FeaturePriority, type FeatureProperties, type LayerKey, type SupabaseFeatureRow } from "@/types/gis";

const DEFAULT_PRIORITY: FeaturePriority = FEATURE_PRIORITIES[0];

export function createDefaultProperties(layerKey: LayerKey): FeatureProperties {
  return {
    external_id: crypto.randomUUID(),
    layer_key: layerKey,
    project_id: "",
    estimated_cost: "",
    title: "",
    notes: "",
    priority: DEFAULT_PRIORITY,
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    source_url: "",
    hidden: false,
  };
}

export function ensureFeatureProperties(feature: Feature<Geometry>): FeatureProperties {
  const raw = (feature.properties ?? {}) as Partial<FeatureProperties>;

  return {
    external_id: raw.external_id ?? crypto.randomUUID(),
    layer_key: (raw.layer_key as LayerKey) ?? "",
    project_id: raw.project_id ?? "",
    estimated_cost: raw.estimated_cost ?? "",
    title: raw.title ?? "",
    notes: raw.notes ?? "",
    priority: FEATURE_PRIORITIES.includes(raw.priority as FeaturePriority)
      ? (raw.priority as FeaturePriority)
      : DEFAULT_PRIORITY,
    contact_name: raw.contact_name ?? "",
    contact_phone: raw.contact_phone ?? "",
    contact_email: raw.contact_email ?? "",
    source_url: raw.source_url ?? "",
    hidden: Boolean(raw.hidden),
  };
}

export function rowToGeoFeature(row: SupabaseFeatureRow): Feature<Geometry, FeatureProperties> {
  return {
    type: "Feature",
    geometry: row.geometry,
    properties: {
      external_id: row.external_id,
      layer_key: row.layer_key,
      project_id: row.project_id ?? "",
      estimated_cost: row.estimated_cost === null || row.estimated_cost === undefined ? "" : String(row.estimated_cost),
      title: row.title ?? "",
      notes: row.notes ?? "",
      priority: row.priority ?? DEFAULT_PRIORITY,
      contact_name: row.contact_name ?? "",
      contact_phone: row.contact_phone ?? "",
      contact_email: row.contact_email ?? "",
      source_url: row.source_url ?? "",
      hidden: false,
    },
  };
}

export function toGeoJson(features: Feature<Geometry, FeatureProperties>[]): FeatureCollection<Geometry, FeatureProperties> {
  return {
    type: "FeatureCollection",
    features,
  };
}

export function toCsv(features: Feature<Geometry, FeatureProperties>[]): string {
  const records = features.map((feature) => {
    const pointGeometry = feature.geometry.type === "Point" ? (feature.geometry as Point) : null;
    const lineGeometry = feature.geometry.type === "LineString" ? (feature.geometry as LineString) : null;

    return {
      external_id: feature.properties.external_id,
      layer_key: feature.properties.layer_key,
      geometry_type: feature.geometry.type,
      title: feature.properties.title,
      notes: feature.properties.notes,
      priority: feature.properties.priority,
      contact_name: feature.properties.contact_name,
      contact_phone: feature.properties.contact_phone,
      contact_email: feature.properties.contact_email,
      source_url: feature.properties.source_url,
      point_lng: pointGeometry?.coordinates?.[0] ?? "",
      point_lat: pointGeometry?.coordinates?.[1] ?? "",
      line_coordinates: lineGeometry ? JSON.stringify(lineGeometry.coordinates) : "",
    };
  });

  return Papa.unparse(records);
}
