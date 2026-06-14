import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EasementRow,
  EngineeringReportRow,
  EngineeringReportType,
  EngineeringRouteRiskRow,
  EnvironmentalConstraintRow,
  EnvironmentalConstraintType,
  ParcelRow,
  RouteCrossingRow,
} from "@/types/phase6";

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

export async function fetchParcels(supabase: SupabaseClient, search: string): Promise<ParcelRow[]> {
  let query = supabase.from("parcels").select("*").order("updated_at", { ascending: false }).limit(500);
  const s = search.trim();
  if (s) {
    query = query.or(`owner_name.ilike.%${s}%,parcel_id.ilike.%${s}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ParcelRow[];
}

export async function upsertParcel(
  supabase: SupabaseClient,
  input: {
    id?: string | null;
    parcel_id: string;
    owner_name: string;
    acreage?: number | null;
    county?: string | null;
    appraised_value?: number | null;
    source?: string | null;
    metadata?: Record<string, unknown>;
    geometry?: GeoJSON.Geometry | null;
  },
): Promise<string> {
  if (!input.parcel_id.trim()) throw new Error("Parcel ID is required");
  if (!input.owner_name.trim()) throw new Error("Owner name is required");

  const { data, error } = await supabase.rpc("upsert_parcel", {
    p_id: input.id ?? null,
    p_parcel_id: input.parcel_id.trim(),
    p_owner_name: input.owner_name.trim(),
    p_acreage: input.acreage ?? null,
    p_county: clean(input.county),
    p_appraised_value: input.appraised_value ?? null,
    p_source: clean(input.source),
    p_metadata: input.metadata ?? {},
    p_geometry: input.geometry ?? null,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function deleteParcel(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("parcels").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchEasements(supabase: SupabaseClient): Promise<EasementRow[]> {
  const { data, error } = await supabase.from("easements").select("*").order("updated_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as EasementRow[];
}

export async function upsertEasement(
  supabase: SupabaseClient,
  input: {
    id?: string | null;
    easement_owner: string;
    route_alternative_id?: string | null;
    parcel_id?: string | null;
    width_ft?: number | null;
    length_ft?: number | null;
    status?: EasementRow["status"];
    notes?: string | null;
    geometry?: GeoJSON.Geometry | null;
  },
): Promise<string> {
  if (!input.easement_owner.trim()) throw new Error("Owner is required");

  const { data, error } = await supabase.rpc("upsert_easement", {
    p_id: input.id ?? null,
    p_easement_owner: input.easement_owner.trim(),
    p_route_alternative_id: input.route_alternative_id ?? null,
    p_parcel_id: input.parcel_id ?? null,
    p_width_ft: input.width_ft ?? null,
    p_length_ft: input.length_ft ?? null,
    p_status: input.status ?? "proposed",
    p_notes: clean(input.notes),
    p_geometry: input.geometry ?? null,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function deleteEasement(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("easements").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchEnvironmentalConstraints(supabase: SupabaseClient): Promise<EnvironmentalConstraintRow[]> {
  const { data, error } = await supabase
    .from("environmental_constraints")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as EnvironmentalConstraintRow[];
}

export async function upsertEnvironmentalConstraint(
  supabase: SupabaseClient,
  input: {
    id?: string | null;
    constraint_type: EnvironmentalConstraintType;
    geometry: GeoJSON.Geometry;
    name?: string | null;
    severity?: number;
    notes?: string | null;
    source?: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("upsert_environmental_constraint", {
    p_id: input.id ?? null,
    p_constraint_type: input.constraint_type,
    p_geometry: input.geometry,
    p_name: clean(input.name),
    p_severity: Math.max(1, Math.min(5, Number(input.severity ?? 3))),
    p_notes: clean(input.notes),
    p_source: clean(input.source),
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function deleteEnvironmentalConstraint(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("environmental_constraints").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchEngineeringRowLayers(
  supabase: SupabaseClient,
): Promise<Array<{ layer_name: string | null; count: number }>> {
  const { data, error } = await supabase
    .from("row_corridors")
    .select("layer_name", { count: "exact" })
    .eq("is_engineering_library", true)
    .limit(5000);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = (row as { layer_name?: string | null }).layer_name ?? "Unclassified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([layer_name, count]) => ({ layer_name, count })).sort((a, b) => a.layer_name.localeCompare(b.layer_name));
}

export async function insertEngineeringRowFeature(
  supabase: SupabaseClient,
  input: {
    layer_name: string;
    name: string;
    corridor_type: string;
    source?: string | null;
    notes?: string | null;
    geometry: GeoJSON.Geometry;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("upsert_row_corridor", {
    p_id: null,
    p_name: input.name.trim(),
    p_corridor_type: input.corridor_type.trim(),
    p_corridor_owner: null,
    p_width_ft: null,
    p_source: clean(input.source) ?? "Engineering Layer Library",
    p_verification_status: "partial",
    p_notes: clean(input.notes),
    p_geometry: input.geometry,
  });
  if (error) throw new Error(error.message);

  const id = String(data);
  const { error: patchError } = await supabase
    .from("row_corridors")
    .update({ layer_name: input.layer_name, is_engineering_library: true })
    .eq("id", id);
  if (patchError) throw new Error(patchError.message);
  return id;
}

export async function refreshRouteCrossings(supabase: SupabaseClient, routeAlternativeId: string): Promise<RouteCrossingRow[]> {
  const { error } = await supabase.rpc("refresh_route_crossings", { p_route_alternative_id: routeAlternativeId });
  if (error) throw new Error(error.message);

  const { data, error: rowsError } = await supabase
    .from("route_crossings")
    .select("*")
    .eq("route_alternative_id", routeAlternativeId)
    .order("crossing_type", { ascending: true });
  if (rowsError) throw new Error(rowsError.message);
  return (data ?? []) as RouteCrossingRow[];
}

export async function fetchRouteRiskScores(supabase: SupabaseClient, projectId?: string): Promise<EngineeringRouteRiskRow[]> {
  const { data, error } = await supabase.rpc("get_engineering_route_risk", {
    p_project_id: projectId ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as EngineeringRouteRiskRow[];
}

export async function createEngineeringReport(
  supabase: SupabaseClient,
  input: {
    report_type: EngineeringReportType;
    route_alternative_id?: string | null;
    project_id?: string | null;
    title?: string | null;
    parameters?: Record<string, unknown>;
    notes?: string | null;
    status?: "generated" | "failed";
  },
): Promise<EngineeringReportRow> {
  const { data, error } = await supabase
    .from("engineering_reports")
    .insert({
      report_type: input.report_type,
      route_alternative_id: input.route_alternative_id ?? null,
      project_id: input.project_id ?? null,
      title: clean(input.title),
      parameters: input.parameters ?? {},
      notes: clean(input.notes),
      status: input.status ?? "generated",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as EngineeringReportRow;
}

export async function fetchEngineeringReports(supabase: SupabaseClient): Promise<EngineeringReportRow[]> {
  const { data, error } = await supabase.from("engineering_reports").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as EngineeringReportRow[];
}

export async function deleteEngineeringReport(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("engineering_reports").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
