export type ParcelRow = {
  id: string;
  owner_id: string;
  parcel_id: string;
  owner_name: string;
  acreage: number | null;
  county: string | null;
  appraised_value: number | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type EasementStatus = "proposed" | "in_review" | "negotiating" | "approved" | "recorded" | "closed";

export type EasementRow = {
  id: string;
  owner_id: string;
  route_alternative_id: string | null;
  parcel_id: string | null;
  easement_owner: string;
  width_ft: number | null;
  length_ft: number | null;
  status: EasementStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EnvironmentalConstraintType =
  | "fema_floodplain"
  | "wetlands"
  | "coastal_barriers"
  | "protected_habitats"
  | "water_bodies"
  | "other";

export type EnvironmentalConstraintRow = {
  id: string;
  owner_id: string;
  constraint_type: EnvironmentalConstraintType;
  name: string | null;
  severity: number;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type RouteCrossingRow = {
  id: string;
  owner_id: string;
  route_alternative_id: string;
  crossing_type: "road" | "railroad" | "canal" | "utility";
  crossing_count: number;
  details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type EngineeringReportType =
  | "route_summary_pdf"
  | "crossing_report"
  | "environmental_constraint_report"
  | "easement_report";

export type EngineeringReportRow = {
  id: string;
  owner_id: string;
  report_type: EngineeringReportType;
  route_alternative_id: string | null;
  project_id: string | null;
  title: string | null;
  parameters: Record<string, unknown> | null;
  file_bucket: string | null;
  file_path: string | null;
  status: "generated" | "failed";
  notes: string | null;
  created_at: string;
};

export type EngineeringRouteRiskRow = {
  route_alternative_id: string;
  project_id: string;
  route_name: string;
  length_miles: number;
  estimated_cost: number;
  environmental_risk: number;
  row_complexity: number;
  crossing_count: number;
  land_acquisition_needs: number;
  easement_requirements: number;
  total_risk_score: number;
};
