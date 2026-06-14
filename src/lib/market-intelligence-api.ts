import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CipProjectRow,
  DemandForecastRow,
  DroughtScoreRow,
  MarketHeatRow,
  OpportunityScoreRow,
  PopulationDataRow,
  UtilityProfileRow,
  UtilityType,
} from "@/types/phase7";

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

export async function fetchUtilities(supabase: SupabaseClient): Promise<UtilityProfileRow[]> {
  const { data, error } = await supabase.from("utility_profiles").select("*").order("updated_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as UtilityProfileRow[];
}

export async function createUtility(
  supabase: SupabaseClient,
  input: { name: string; utility_type: UtilityType; county?: string; service_area?: string; notes?: string },
): Promise<UtilityProfileRow> {
  if (!input.name.trim()) throw new Error("Name is required");
  const { data, error } = await supabase
    .from("utility_profiles")
    .insert({
      name: input.name.trim(),
      utility_type: input.utility_type,
      county: clean(input.county),
      service_area: clean(input.service_area),
      notes: clean(input.notes),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as UtilityProfileRow;
}

export async function deleteUtility(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("utility_profiles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function upsertByUtility<T>(
  supabase: SupabaseClient,
  table: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.from(table).upsert(payload, { onConflict: "owner_id,utility_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return data as T;
}

export function upsertDemandForecast(
  supabase: SupabaseClient,
  input: Omit<DemandForecastRow, "id" | "owner_id" | "created_at" | "updated_at">,
) {
  return upsertByUtility<DemandForecastRow>(supabase, "demand_forecasts", input);
}

export async function fetchDemandForecasts(supabase: SupabaseClient): Promise<DemandForecastRow[]> {
  const { data, error } = await supabase.from("demand_forecasts").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DemandForecastRow[];
}

export function upsertPopulationData(
  supabase: SupabaseClient,
  input: Omit<PopulationDataRow, "id" | "owner_id" | "created_at" | "updated_at">,
) {
  return upsertByUtility<PopulationDataRow>(supabase, "population_data", input);
}

export async function fetchPopulationData(supabase: SupabaseClient): Promise<PopulationDataRow[]> {
  const { data, error } = await supabase.from("population_data").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PopulationDataRow[];
}

export function upsertDroughtScore(
  supabase: SupabaseClient,
  input: Omit<DroughtScoreRow, "id" | "owner_id" | "total_score" | "created_at" | "updated_at">,
) {
  return upsertByUtility<DroughtScoreRow>(supabase, "drought_scores", input);
}

export async function fetchDroughtScores(supabase: SupabaseClient): Promise<DroughtScoreRow[]> {
  const { data, error } = await supabase.from("drought_scores").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DroughtScoreRow[];
}

export function upsertOpportunityScore(
  supabase: SupabaseClient,
  input: Omit<OpportunityScoreRow, "id" | "owner_id" | "total_opportunity_score" | "created_at" | "updated_at">,
) {
  return upsertByUtility<OpportunityScoreRow>(supabase, "opportunity_scores", input);
}

export async function fetchOpportunityScores(supabase: SupabaseClient): Promise<OpportunityScoreRow[]> {
  const { data, error } = await supabase.from("opportunity_scores").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OpportunityScoreRow[];
}

export async function fetchCipProjects(supabase: SupabaseClient): Promise<CipProjectRow[]> {
  const { data, error } = await supabase.from("cip_projects").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CipProjectRow[];
}

export async function createCipProject(
  supabase: SupabaseClient,
  input: Omit<CipProjectRow, "id" | "owner_id" | "created_at" | "updated_at">,
): Promise<CipProjectRow> {
  const { data, error } = await supabase.from("cip_projects").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as CipProjectRow;
}

export async function deleteCipProject(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("cip_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchMarketHeatMap(supabase: SupabaseClient): Promise<MarketHeatRow[]> {
  const { data, error } = await supabase.rpc("get_market_heat_map");
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketHeatRow[];
}
