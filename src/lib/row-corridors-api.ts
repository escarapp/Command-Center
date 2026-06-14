import type { SupabaseClient } from "@supabase/supabase-js";

export type RowCorridorProperties = {
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

export type RowCorridorFeature = GeoJSON.Feature<
  GeoJSON.Geometry,
  RowCorridorProperties
> & { id?: string };

export async function fetchRowCorridorsGeojson(
  supabase: SupabaseClient,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Geometry, RowCorridorProperties>> {
  const { data, error } = await supabase.rpc("get_row_corridors_geojson");
  if (error) throw new Error(error.message);
  return data as GeoJSON.FeatureCollection<GeoJSON.Geometry, RowCorridorProperties>;
}

export async function upsertRowCorridor(
  supabase: SupabaseClient,
  input: {
    id?: string | null;
    name: string;
    corridor_type: string;
    corridor_owner?: string | null;
    width_ft?: number | null;
    source?: string | null;
    verification_status?: "unverified" | "partial" | "verified";
    notes?: string | null;
    geometry: GeoJSON.Geometry;
  },
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const corridorType = input.corridor_type.trim();
  if (!corridorType) throw new Error("Corridor type is required");

  const { data, error } = await supabase.rpc("upsert_row_corridor", {
    p_id: input.id ?? null,
    p_name: name,
    p_corridor_type: corridorType,
    p_corridor_owner: input.corridor_owner?.trim() ? input.corridor_owner.trim() : null,
    p_width_ft: input.width_ft ?? null,
    p_source: input.source?.trim() ? input.source.trim() : null,
    p_verification_status: input.verification_status ?? "unverified",
    p_notes: input.notes?.trim() ? input.notes.trim() : null,
    p_geometry: input.geometry,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function deleteRowCorridor(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("row_corridors").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
