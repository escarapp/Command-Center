import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DemandModelRow,
  DigitalTwinAssetRow,
  DigitalTwinCapacityRow,
  DigitalTwinDashboardRow,
  DigitalTwinForecastRow,
  ExpansionRouteRow,
  FundingOpportunityRow,
  FutureShortageRow,
  HighestDemandRow,
  NetworkConnectionRow,
  NetworkNodeRow,
  SimulationRunRow,
  SupplyModelRow,
} from "@/types/phase9";

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

export async function fetchNetworkNodes(supabase: SupabaseClient, regionCode = "RGV"): Promise<NetworkNodeRow[]> {
  const { data, error } = await supabase
    .from("network_nodes")
    .select("*")
    .eq("region_code", regionCode)
    .order("updated_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as NetworkNodeRow[];
}

export async function createNetworkNode(
  supabase: SupabaseClient,
  input: {
    region_code?: string;
    region_name?: string;
    node_type: NetworkNodeRow["node_type"];
    name: string;
    county?: string;
    latitude?: number | null;
    longitude?: number | null;
  },
): Promise<NetworkNodeRow> {
  const name = input.name.trim();
  if (!name) throw new Error("Node name is required");

  const { data, error } = await supabase
    .from("network_nodes")
    .insert({
      region_code: input.region_code ?? "RGV",
      region_name: input.region_name ?? "Rio Grande Valley",
      node_type: input.node_type,
      name,
      county: clean(input.county),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      metadata: {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as NetworkNodeRow;
}

export async function fetchNetworkConnections(
  supabase: SupabaseClient,
  regionCode = "RGV",
): Promise<NetworkConnectionRow[]> {
  const { data, error } = await supabase
    .from("network_connections")
    .select("*")
    .eq("region_code", regionCode)
    .order("updated_at", { ascending: false })
    .limit(3000);
  if (error) throw new Error(error.message);
  return (data ?? []) as NetworkConnectionRow[];
}

export async function createNetworkConnection(
  supabase: SupabaseClient,
  input: {
    region_code?: string;
    connection_type: NetworkConnectionRow["connection_type"];
    from_node_id: string;
    to_node_id: string;
    length_miles?: number;
    capacity_mgd?: number;
    is_expansion_candidate?: boolean;
  },
): Promise<NetworkConnectionRow> {
  if (!input.from_node_id || !input.to_node_id) throw new Error("From/To nodes are required");
  const { data, error } = await supabase
    .from("network_connections")
    .insert({
      region_code: input.region_code ?? "RGV",
      connection_type: input.connection_type,
      from_node_id: input.from_node_id,
      to_node_id: input.to_node_id,
      length_miles: input.length_miles ?? 0,
      capacity_mgd: input.capacity_mgd ?? 0,
      status: "planned",
      is_expansion_candidate: input.is_expansion_candidate ?? false,
      metadata: {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as NetworkConnectionRow;
}

export async function fetchSupplyModels(supabase: SupabaseClient, regionCode = "RGV"): Promise<SupplyModelRow[]> {
  const { data, error } = await supabase
    .from("supply_models")
    .select("*")
    .eq("region_code", regionCode)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SupplyModelRow[];
}

export async function upsertSupplyModel(
  supabase: SupabaseClient,
  input: {
    region_code?: string;
    county?: string;
    model_name: string;
    drought_pct: number;
    population_growth_pct: number;
    industrial_growth_pct: number;
    new_desal_capacity_mgd: number;
    available_supply_mgd: number;
    projected_demand_mgd: number;
    assumptions?: string;
  },
): Promise<SupplyModelRow> {
  const modelName = input.model_name.trim();
  if (!modelName) throw new Error("Model name is required");

  const payload = {
    region_code: input.region_code ?? "RGV",
    county: clean(input.county),
    model_name: modelName,
    drought_pct: input.drought_pct,
    population_growth_pct: input.population_growth_pct,
    industrial_growth_pct: input.industrial_growth_pct,
    new_desal_capacity_mgd: input.new_desal_capacity_mgd,
    available_supply_mgd: input.available_supply_mgd,
    projected_demand_mgd: input.projected_demand_mgd,
    assumptions: clean(input.assumptions),
  };

  const { data, error } = await supabase
    .from("supply_models")
    .upsert(payload, { onConflict: "owner_id,region_code,county,model_name" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SupplyModelRow;
}

export async function fetchDemandModels(supabase: SupabaseClient, regionCode = "RGV"): Promise<DemandModelRow[]> {
  const { data, error } = await supabase
    .from("demand_models")
    .select("*")
    .eq("region_code", regionCode)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DemandModelRow[];
}

export async function upsertDemandModel(
  supabase: SupabaseClient,
  input: {
    region_code?: string;
    county?: string;
    utility_name: string;
    baseline_demand_mgd: number;
    growth_5y_pct: number;
    growth_10y_pct: number;
    growth_20y_pct: number;
    projected_revenue_5y: number;
    projected_revenue_10y: number;
    projected_revenue_20y: number;
  },
): Promise<DemandModelRow> {
  const utilityName = input.utility_name.trim();
  if (!utilityName) throw new Error("Utility name is required");

  const payload = {
    region_code: input.region_code ?? "RGV",
    county: clean(input.county),
    utility_name: utilityName,
    baseline_demand_mgd: input.baseline_demand_mgd,
    growth_5y_pct: input.growth_5y_pct,
    growth_10y_pct: input.growth_10y_pct,
    growth_20y_pct: input.growth_20y_pct,
    projected_revenue_5y: input.projected_revenue_5y,
    projected_revenue_10y: input.projected_revenue_10y,
    projected_revenue_20y: input.projected_revenue_20y,
  };

  const { data, error } = await supabase
    .from("demand_models")
    .upsert(payload, { onConflict: "owner_id,region_code,utility_name" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as DemandModelRow;
}

export async function fetchSimulationRuns(supabase: SupabaseClient, regionCode = "RGV"): Promise<SimulationRunRow[]> {
  const { data, error } = await supabase
    .from("simulation_runs")
    .select("*")
    .eq("region_code", regionCode)
    .order("run_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SimulationRunRow[];
}

export async function createSimulationRun(
  supabase: SupabaseClient,
  input: {
    region_code?: string;
    name: string;
    scenario_type: SimulationRunRow["scenario_type"];
    parameters?: Record<string, unknown>;
    results?: Record<string, unknown>;
    status?: SimulationRunRow["status"];
  },
): Promise<SimulationRunRow> {
  const name = input.name.trim();
  if (!name) throw new Error("Simulation name is required");

  const { data, error } = await supabase
    .from("simulation_runs")
    .insert({
      region_code: input.region_code ?? "RGV",
      name,
      scenario_type: input.scenario_type,
      parameters: input.parameters ?? {},
      results: input.results ?? {},
      status: input.status ?? "completed",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SimulationRunRow;
}

export async function fetchDigitalTwinAssets(supabase: SupabaseClient, regionCode = "RGV"): Promise<DigitalTwinAssetRow[]> {
  const { data, error } = await supabase
    .from("digital_twin_assets")
    .select("*")
    .eq("region_code", regionCode)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DigitalTwinAssetRow[];
}

export async function createDigitalTwinAsset(
  supabase: SupabaseClient,
  input: {
    region_code?: string;
    asset_type: DigitalTwinAssetRow["asset_type"];
    asset_name: string;
    county?: string;
    status?: DigitalTwinAssetRow["status"];
    capacity_impact_mgd?: number;
    estimated_cost?: number;
    target_year?: number;
    risk_score?: number;
    opportunity_score?: number;
  },
): Promise<DigitalTwinAssetRow> {
  const assetName = input.asset_name.trim();
  if (!assetName) throw new Error("Asset name is required");

  const { data, error } = await supabase
    .from("digital_twin_assets")
    .insert({
      region_code: input.region_code ?? "RGV",
      asset_type: input.asset_type,
      asset_name: assetName,
      county: clean(input.county),
      status: input.status ?? "planned",
      capacity_impact_mgd: input.capacity_impact_mgd ?? 0,
      estimated_cost: input.estimated_cost ?? 0,
      target_year: input.target_year ?? null,
      risk_score: input.risk_score ?? 0,
      opportunity_score: input.opportunity_score ?? 0,
      metadata: {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as DigitalTwinAssetRow;
}

export async function fetchDigitalTwinDashboard(
  supabase: SupabaseClient,
  regionCode = "RGV",
): Promise<DigitalTwinDashboardRow[]> {
  const { data, error } = await supabase.rpc("get_digital_twin_dashboard", { p_region_code: regionCode });
  if (error) throw new Error(error.message);
  return (data ?? []) as DigitalTwinDashboardRow[];
}

export async function fetchDigitalTwinCapacity(
  supabase: SupabaseClient,
  regionCode = "RGV",
): Promise<DigitalTwinCapacityRow[]> {
  const { data, error } = await supabase.rpc("get_digital_twin_capacity", { p_region_code: regionCode });
  if (error) throw new Error(error.message);
  return (data ?? []) as DigitalTwinCapacityRow[];
}

export async function fetchDigitalTwinForecasts(
  supabase: SupabaseClient,
  regionCode = "RGV",
): Promise<DigitalTwinForecastRow[]> {
  const { data, error } = await supabase.rpc("get_digital_twin_forecasts", { p_region_code: regionCode });
  if (error) throw new Error(error.message);
  return (data ?? []) as DigitalTwinForecastRow[];
}

export async function fetchBestExpansionRoutes(
  supabase: SupabaseClient,
  regionCode = "RGV",
): Promise<ExpansionRouteRow[]> {
  const { data, error } = await supabase.rpc("get_best_expansion_routes", { p_region_code: regionCode });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpansionRouteRow[];
}

export async function fetchHighestDemandUtility(supabase: SupabaseClient, regionCode = "RGV"): Promise<HighestDemandRow[]> {
  const { data, error } = await supabase.rpc("get_highest_demand_utility", { p_region_code: regionCode });
  if (error) throw new Error(error.message);
  return (data ?? []) as HighestDemandRow[];
}

export async function fetchFutureShortagesByCounty(
  supabase: SupabaseClient,
  regionCode = "RGV",
): Promise<FutureShortageRow[]> {
  const { data, error } = await supabase.rpc("get_future_shortages_by_county", { p_region_code: regionCode });
  if (error) throw new Error(error.message);
  return (data ?? []) as FutureShortageRow[];
}

export async function fetchDigitalTwinFundingOpportunities(
  supabase: SupabaseClient,
  regionCode = "RGV",
): Promise<FundingOpportunityRow[]> {
  const { data, error } = await supabase.rpc("get_digital_twin_funding_opportunities", { p_region_code: regionCode });
  if (error) throw new Error(error.message);
  return (data ?? []) as FundingOpportunityRow[];
}
