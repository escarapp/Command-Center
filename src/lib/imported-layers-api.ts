import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportedLayerRow } from "@/types/phase3";

export async function fetchImportedLayers(supabase: SupabaseClient): Promise<ImportedLayerRow[]> {
  const { data, error } = await supabase
    .from("imported_layers")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ImportedLayerRow[];
}

export async function createImportedLayer(
  supabase: SupabaseClient,
  input: { name: string; source_file_id?: string | null },
): Promise<ImportedLayerRow> {
  const name = input.name.trim();
  if (!name) throw new Error("Layer name is required");

  const { data, error } = await supabase
    .from("imported_layers")
    .insert({
      name,
      source_file_id: input.source_file_id ?? null,
      default_visible: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ImportedLayerRow;
}

export async function deleteImportedLayer(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("imported_layers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertImportedGeometry(
  supabase: SupabaseClient,
  input: { imported_layer_id: string; feature_type: string; geometry: GeoJSON.Geometry; properties: Record<string, unknown> },
): Promise<void> {
  const { error } = await supabase.rpc("insert_imported_geometry", {
    p_imported_layer_id: input.imported_layer_id,
    p_feature_type: input.feature_type,
    p_geometry: input.geometry,
    p_properties: input.properties,
  });
  if (error) throw new Error(error.message);
}

export async function getImportedLayerGeojson(supabase: SupabaseClient, importedLayerId: string): Promise<GeoJSON.FeatureCollection> {
  const { data, error } = await supabase.rpc("get_imported_layer_geojson", {
    p_imported_layer_id: importedLayerId,
  });
  if (error) throw new Error(error.message);
  return data as GeoJSON.FeatureCollection;
}
