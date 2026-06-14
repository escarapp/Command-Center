import type { SupabaseClient } from "@supabase/supabase-js";
import type { MapOverlayRow } from "@/types/phase3";

export type OverlayCorners = [[number, number], [number, number], [number, number], [number, number]];

export function isValidCorners(value: unknown): value is OverlayCorners {
  if (!Array.isArray(value) || value.length !== 4) return false;
  return value.every(
    (pair) =>
      Array.isArray(pair) &&
      pair.length === 2 &&
      typeof pair[0] === "number" &&
      Number.isFinite(pair[0]) &&
      typeof pair[1] === "number" &&
      Number.isFinite(pair[1]),
  );
}

export async function fetchMapOverlays(supabase: SupabaseClient): Promise<MapOverlayRow[]> {
  const { data, error } = await supabase.from("map_overlays").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MapOverlayRow[];
}

export async function createMapOverlay(
  supabase: SupabaseClient,
  input: {
    name: string;
    uploaded_file_id: string | null;
    image_bucket: string;
    image_path: string;
    image_width: number | null;
    image_height: number | null;
    opacity?: number;
  },
): Promise<MapOverlayRow> {
  const name = input.name.trim();
  if (!name) throw new Error("Overlay name is required");

  const { data, error } = await supabase
    .from("map_overlays")
    .insert({
      name,
      uploaded_file_id: input.uploaded_file_id,
      image_bucket: input.image_bucket,
      image_path: input.image_path,
      image_width: input.image_width,
      image_height: input.image_height,
      opacity: typeof input.opacity === "number" ? input.opacity : 0.6,
      corners: null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as MapOverlayRow;
}

export async function updateMapOverlayOpacity(supabase: SupabaseClient, id: string, opacity: number): Promise<void> {
  const safe = Math.max(0, Math.min(1, opacity));
  const { error } = await supabase.from("map_overlays").update({ opacity: safe }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateMapOverlayCorners(supabase: SupabaseClient, id: string, corners: OverlayCorners | null): Promise<void> {
  const { error } = await supabase.from("map_overlays").update({ corners }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMapOverlay(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("map_overlays").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getOverlaySignedUrl(
  supabase: SupabaseClient,
  input: { bucket: string; path: string; expiresInSeconds?: number },
): Promise<string> {
  const expiresIn = input.expiresInSeconds ?? 60 * 60;
  const { data, error } = await supabase.storage.from(input.bucket).createSignedUrl(input.path, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
