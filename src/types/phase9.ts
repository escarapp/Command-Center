export type NetworkNodeType =
  | "utility"
  | "wsc"
  | "irrigation_district"
  | "drainage_district"
  | "treatment_plant"
  | "reservoir"
  | "pipeline_junction"
  | "pump_station"
  | "storage_facility"
  | "water_source"
  | "customer";

export type NetworkConnectionType =
  | "water_source_to_treatment"
  | "treatment_to_storage"
  | "transmission"
  | "distribution"
  | "customer_supply"
  | "interconnect"
  | "drainage";

export type NetworkNodeRow = {
  id: string;
  owner_id: string;
  region_code: string;
  region_name: string;
  node_type: NetworkNodeType;
  name: string;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type NetworkConnectionRow = {
  id: string;
  owner_id: string;
  region_code: string;
  connection_type: NetworkConnectionType;
  from_node_id: string;
  to_node_id: string;
  length_miles: number;
  capacity_mgd: number;
  status: "active" | "planned" | "offline";
  is_expansion_candidate: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SupplyModelRow = {
  id: string;
  owner_id: string;
  region_code: string;
  county: string | null;
  model_name: string;
  drought_pct: number;
  population_growth_pct: number;
  industrial_growth_pct: number;
  new_desal_capacity_mgd: number;
  available_supply_mgd: number;
  future_supply_mgd: number;
  projected_demand_mgd: number;
  deficit_mgd: number;
  surplus_mgd: number;
  assumptions: string | null;
  created_at: string;
  updated_at: string;
};

export type DemandModelRow = {
  id: string;
  owner_id: string;
  region_code: string;
  county: string | null;
  utility_name: string;
  baseline_demand_mgd: number;
  growth_5y_pct: number;
  growth_10y_pct: number;
  growth_20y_pct: number;
  projected_demand_5y_mgd: number;
  projected_demand_10y_mgd: number;
  projected_demand_20y_mgd: number;
  projected_revenue_5y: number;
  projected_revenue_10y: number;
  projected_revenue_20y: number;
  created_at: string;
  updated_at: string;
};

export type SimulationRunRow = {
  id: string;
  owner_id: string;
  region_code: string;
  name: string;
  scenario_type: "capacity" | "expansion" | "risk" | "funding";
  parameters: Record<string, unknown>;
  results: Record<string, unknown>;
  status: "queued" | "running" | "completed" | "failed";
  run_at: string;
  created_at: string;
  updated_at: string;
};

export type DigitalTwinAssetRow = {
  id: string;
  owner_id: string;
  region_code: string;
  asset_type: "pipeline" | "customer" | "storage" | "plant" | "pump_station" | "reservoir";
  asset_name: string;
  county: string | null;
  status: "planned" | "in_progress" | "active" | "deferred";
  capacity_impact_mgd: number;
  estimated_cost: number;
  target_year: number | null;
  risk_score: number;
  opportunity_score: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DigitalTwinDashboardRow = {
  region_code: string;
  total_demand_mgd: number;
  total_supply_mgd: number;
  capacity_gap_mgd: number;
  growth_forecast_mgd: number;
  active_assets: number;
  high_risk_assets: number;
  top_opportunity_count: number;
};

export type DigitalTwinCapacityRow = {
  county: string;
  available_supply_mgd: number;
  future_supply_mgd: number;
  projected_demand_mgd: number;
  deficit_mgd: number;
  surplus_mgd: number;
};

export type DigitalTwinForecastRow = {
  utility_name: string;
  county: string;
  demand_5y_mgd: number;
  demand_10y_mgd: number;
  demand_20y_mgd: number;
  revenue_5y: number;
  revenue_10y: number;
  revenue_20y: number;
  capacity_need_mgd: number;
  recommended_expansion_year: number;
};

export type ExpansionRouteRow = {
  connection_id: string;
  from_node: string;
  to_node: string;
  connection_type: NetworkConnectionType;
  length_miles: number;
  capacity_mgd: number;
  route_score: number;
};

export type HighestDemandRow = {
  utility_name: string;
  county: string;
  projected_demand_20y_mgd: number;
};

export type FutureShortageRow = {
  county: string;
  shortage_mgd: number;
};

export type FundingOpportunityRow = {
  program_name: string;
  category: string;
  estimated_gap_mgd: number;
  rationale: string;
};
