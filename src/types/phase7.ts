export type UtilityType = "city" | "wsc" | "irrigation_district" | "drainage_district" | "industrial_user";

export type UtilityProfileRow = {
  id: string;
  owner_id: string;
  name: string;
  utility_type: UtilityType;
  county: string | null;
  service_area: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DemandForecastRow = {
  id: string;
  owner_id: string;
  utility_id: string;
  current_demand_mgd: number;
  demand_5y_mgd: number;
  demand_10y_mgd: number;
  demand_20y_mgd: number;
  assumptions: string | null;
  created_at: string;
  updated_at: string;
};

export type PopulationDataRow = {
  id: string;
  owner_id: string;
  utility_id: string;
  population: number;
  growth_rate_pct: number;
  new_developments: number;
  data_year: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DroughtScoreRow = {
  id: string;
  owner_id: string;
  utility_id: string;
  water_source_dependency_score: number;
  reservoir_exposure_score: number;
  historic_shortages_score: number;
  total_score: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityScoreRow = {
  id: string;
  owner_id: string;
  utility_id: string;
  potential_mgd_demand: number;
  revenue_potential_score: number;
  political_support_score: number;
  funding_access_score: number;
  total_opportunity_score: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CipProjectRow = {
  id: string;
  owner_id: string;
  utility_id: string;
  project_name: string;
  estimated_cost: number;
  completion_date: string | null;
  status: "planned" | "in_progress" | "on_hold" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketHeatRow = {
  utility_id: string;
  utility_name: string;
  utility_type: UtilityType;
  demand_growth_mgd: number;
  drought_risk_score: number;
  opportunity_score: number;
  heat_score: number;
};
