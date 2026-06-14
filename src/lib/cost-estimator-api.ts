import type { SupabaseClient } from "@supabase/supabase-js";
import type { RouteCostEstimateRow } from "@/types/phase3";

export async function fetchLatestCostEstimateForProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<RouteCostEstimateRow | null> {
  const { data, error } = await supabase
    .from("route_cost_estimates")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as RouteCostEstimateRow | undefined;
  return row ?? null;
}

export async function upsertCostEstimate(
  supabase: SupabaseClient,
  input: {
    id?: string | null;
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
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("upsert_route_cost_estimate", {
    p_id: input.id ?? null,
    p_project_id: input.project_id,
    p_pipeline_miles: input.pipeline_miles,
    p_cost_per_mile: input.cost_per_mile,
    p_pump_station_cost: input.pump_station_cost,
    p_storage_tank_cost: input.storage_tank_cost,
    p_land_easement_cost: input.land_easement_cost,
    p_engineering_design_pct: input.engineering_design_pct,
    p_permitting_environmental_pct: input.permitting_environmental_pct,
    p_contingency_pct: input.contingency_pct,
    p_notes: input.notes?.trim() ? input.notes.trim() : null,
  });

  if (error) throw new Error(error.message);
  return String(data);
}
