import type { SupabaseClient } from "@supabase/supabase-js";

export type RouteAlternativeProperties = {
  project_id: string;
  name: string;
  cost_per_mile: number | null;
  crossings: string | null;
  easement_concerns: string | null;
  permitting_concerns: string | null;
  environmental_concerns: string | null;
  notes: string | null;
  updated_at: string;
};

export type RouteAlternativeFeature = GeoJSON.Feature<GeoJSON.LineString, RouteAlternativeProperties> & { id?: string };

export async function fetchRouteAlternativesGeojson(
  supabase: SupabaseClient,
  projectId: string,
): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString, RouteAlternativeProperties>> {
  const { data, error } = await supabase.rpc("get_route_alternatives_geojson", {
    p_project_id: projectId,
  });
  if (error) throw new Error(error.message);
  return data as GeoJSON.FeatureCollection<GeoJSON.LineString, RouteAlternativeProperties>;
}

export async function upsertRouteAlternative(
  supabase: SupabaseClient,
  input: {
    id?: string | null;
    project_id: string;
    name: string;
    cost_per_mile?: number | null;
    crossings?: string | null;
    easement_concerns?: string | null;
    permitting_concerns?: string | null;
    environmental_concerns?: string | null;
    notes?: string | null;
    geometry: GeoJSON.LineString;
  },
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const { data, error } = await supabase.rpc("upsert_route_alternative", {
    p_id: input.id ?? null,
    p_project_id: input.project_id,
    p_name: name,
    p_cost_per_mile: input.cost_per_mile ?? null,
    p_crossings: input.crossings?.trim() ? input.crossings.trim() : null,
    p_easement_concerns: input.easement_concerns?.trim() ? input.easement_concerns.trim() : null,
    p_permitting_concerns: input.permitting_concerns?.trim() ? input.permitting_concerns.trim() : null,
    p_environmental_concerns: input.environmental_concerns?.trim() ? input.environmental_concerns.trim() : null,
    p_notes: input.notes?.trim() ? input.notes.trim() : null,
    p_geometry: input.geometry,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function deleteRouteAlternative(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("route_alternatives").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
