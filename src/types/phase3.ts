export type UploadedFileKind =
  | "pdf"
  | "png"
  | "jpg"
  | "jpeg"
  | "geojson"
  | "kml"
  | "kmz"
  | "shp_zip"
  | "other";

export type UploadedFileRow = {
  id: string;
  bucket: string;
  path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  file_kind: UploadedFileKind;
  project_id: string | null;
  route_alternative_id: string | null;
  crm_organization_id: string | null;
  county_name: string | null;
  district_name: string | null;
  utility_name: string | null;
  notes: string | null;
  created_at: string;
};

export type ImportedLayerRow = {
  id: string;
  name: string;
  source_file_id: string | null;
  default_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type MapOverlayRow = {
  id: string;
  name: string;
  uploaded_file_id: string | null;
  image_bucket: string;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  opacity: number;
  corners: unknown | null;
  created_at: string;
  updated_at: string;
};

export type RowCorridorRow = {
  id: string;
  name: string;
  corridor_type: string;
  corridor_owner: string | null;
  width_ft: number | null;
  source: string | null;
  verification_status: "unverified" | "partial" | "verified";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RouteAlternativeRow = {
  id: string;
  project_id: string;
  name: string;
  cost_per_mile: number | null;
  crossings: string | null;
  easement_concerns: string | null;
  permitting_concerns: string | null;
  environmental_concerns: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RouteCostEstimateRow = {
  id: string;
  project_id: string;
  pipeline_miles: number | null;
  cost_per_mile: number | null;
  pump_station_cost: number | null;
  storage_tank_cost: number | null;
  land_easement_cost: number | null;
  engineering_design_pct: number | null;
  permitting_environmental_pct: number | null;
  contingency_pct: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
