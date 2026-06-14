// Layers are dynamic and stored in Supabase (see `gis_layers`).
// `layer_key` is a stable identifier string (we use UUID strings by default).
export type LayerKey = string;

export type GisLayerRow = {
  id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const FEATURE_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type FeaturePriority = (typeof FEATURE_PRIORITIES)[number];

export type FeatureProperties = {
  external_id: string;
  layer_key: LayerKey;
  project_id?: string;
  estimated_cost?: string;
  title: string;
  notes: string;
  priority: FeaturePriority;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  source_url: string;
  hidden?: boolean;
};

export type SupabaseFeatureRow = {
  id: string;
  external_id: string;
  layer_key: LayerKey;
  project_id: string | null;
  estimated_cost: number | null;
  title: string | null;
  notes: string | null;
  priority: FeaturePriority | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  source_url: string | null;
  geometry: GeoJSON.Geometry;
  created_at: string;
  updated_at: string;
};
