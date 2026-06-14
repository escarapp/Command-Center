import type { SupabaseClient } from "@supabase/supabase-js";
import type { GisLayerRow } from "@/types/gis";

const STARTER_LAYERS: Array<Pick<GisLayerRow, "key" | "label" | "color">> = [
  { key: "desal_plant", label: "Desal Plant Location", color: "#005f73" },
  { key: "intake_outfall", label: "Intake/Outfall Location", color: "#0a9396" },
  { key: "proposed_pipeline", label: "Proposed Pipeline Routes", color: "#ca6702" },
  { key: "utilities", label: "Utilities", color: "#2f3e46" },
  { key: "water_supply_corp", label: "Water Supply Corporations", color: "#3a5a40" },
  { key: "irrigation_district", label: "Irrigation Districts", color: "#6a994e" },
  { key: "drainage_district", label: "Drainage Districts", color: "#6c757d" },
  { key: "treatment_plant", label: "Treatment Plants", color: "#118ab2" },
  { key: "reservoir", label: "Reservoirs", color: "#457b9d" },
  { key: "connection_point", label: "Potential Connection Points", color: "#e63946" },
];

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export async function fetchLayers(supabase: SupabaseClient): Promise<GisLayerRow[]> {
  const { data, error } = await supabase
    .from("gis_layers")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as GisLayerRow[];
}

export async function ensureStarterLayers(supabase: SupabaseClient): Promise<void> {
  const existing = await fetchLayers(supabase);
  if (existing.length > 0) return;

  const payload = STARTER_LAYERS.map((layer, index) => ({
    key: layer.key,
    label: layer.label,
    color: layer.color,
    sort_order: index,
  }));

  const { error } = await supabase.from("gis_layers").insert(payload);
  if (error) throw new Error(error.message);
}

export async function createLayer(
  supabase: SupabaseClient,
  input: { label: string; color?: string },
): Promise<GisLayerRow> {
  const label = input.label.trim();
  if (!label) throw new Error("Layer name is required");

  const baseKey = slugify(label) || "layer";
  const key = `${baseKey}_${crypto.randomUUID().slice(0, 8)}`;

  const { data: maxRow, error: maxError } = await supabase
    .from("gis_layers")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) throw new Error(maxError.message);
  const nextSortOrder = ((maxRow?.sort_order as number | null | undefined) ?? 0) + 1;

  const { data, error } = await supabase
    .from("gis_layers")
    .insert({
      key,
      label,
      color: input.color ?? "#3bb2d0",
      sort_order: nextSortOrder,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as GisLayerRow;
}

export async function updateLayer(
  supabase: SupabaseClient,
  key: string,
  patch: Partial<Pick<GisLayerRow, "label" | "color" | "sort_order">>,
): Promise<void> {
  const { error } = await supabase.from("gis_layers").update(patch).eq("key", key);
  if (error) throw new Error(error.message);
}

export async function deleteLayerAndFeatures(supabase: SupabaseClient, key: string): Promise<void> {
  // Delete features first to avoid leaving orphans.
  const { error: featuresError } = await supabase.from("gis_features").delete().eq("layer_key", key);
  if (featuresError) throw new Error(featuresError.message);

  const { error: layerError } = await supabase.from("gis_layers").delete().eq("key", key);
  if (layerError) throw new Error(layerError.message);
}
