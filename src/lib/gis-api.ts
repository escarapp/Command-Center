import type { Feature, Geometry } from "geojson";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeatureProperties, SupabaseFeatureRow } from "@/types/gis";

export async function fetchFeatures(supabase: SupabaseClient): Promise<SupabaseFeatureRow[]> {
  const { data, error } = await supabase
    .from("gis_features_geojson")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SupabaseFeatureRow[];
}

export async function upsertFeature(
  supabase: SupabaseClient,
  feature: Feature<Geometry, FeatureProperties>,
): Promise<void> {
  const sourceUrl = feature.properties.source_url.trim();
  const projectId = (feature.properties.project_id ?? "").trim();
  const estimatedCostRaw = (feature.properties.estimated_cost ?? "").trim();
  const estimatedCost = estimatedCostRaw.length > 0 ? Number(estimatedCostRaw) : null;

  if (estimatedCostRaw.length > 0 && !Number.isFinite(estimatedCost)) {
    throw new Error("Estimated cost must be a number");
  }

  const { error } = await supabase.rpc("upsert_gis_feature", {
    p_external_id: feature.properties.external_id,
    p_layer_key: feature.properties.layer_key,
    p_geometry: feature.geometry,
    p_title: feature.properties.title,
    p_notes: feature.properties.notes,
    p_priority: feature.properties.priority,
    p_contact_name: feature.properties.contact_name,
    p_contact_phone: feature.properties.contact_phone,
    p_contact_email: feature.properties.contact_email,
    p_source_url: sourceUrl.length > 0 ? sourceUrl : null,
    p_project_id: projectId.length > 0 ? projectId : null,
    p_estimated_cost: estimatedCost,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteFeatureByExternalId(supabase: SupabaseClient, externalId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_gis_feature", {
    p_external_id: externalId,
  });

  if (error) {
    throw new Error(error.message);
  }
}
