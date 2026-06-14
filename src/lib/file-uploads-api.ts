import type { SupabaseClient } from "@supabase/supabase-js";
import type { UploadedFileKind, UploadedFileRow } from "@/types/phase3";

function inferKind(file: File): UploadedFileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg")) return "jpg";
  if (name.endsWith(".jpeg")) return "jpeg";
  if (name.endsWith(".geojson") || name.endsWith(".json")) return "geojson";
  if (name.endsWith(".kml")) return "kml";
  if (name.endsWith(".kmz")) return "kmz";
  if (name.endsWith(".zip")) return "shp_zip";
  return "other";
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function fetchUploadedFiles(supabase: SupabaseClient): Promise<UploadedFileRow[]> {
  const { data, error } = await supabase
    .from("uploaded_files")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as UploadedFileRow[];
}

export async function uploadPlanningFile(
  supabase: SupabaseClient,
  input: {
    file: File;
    project_id?: string;
    crm_organization_id?: string;
    county_name?: string;
    district_name?: string;
    utility_name?: string;
    notes?: string;
  },
): Promise<UploadedFileRow> {
  const kind = inferKind(input.file);
  const safe = sanitizeFilename(input.file.name);
  const objectPath = `${kind}/${crypto.randomUUID()}_${safe}`;

  const { error: uploadError } = await supabase.storage.from("planning_uploads").upload(objectPath, input.file, {
    upsert: false,
    contentType: input.file.type || undefined,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("uploaded_files")
    .insert({
      bucket: "planning_uploads",
      path: objectPath,
      filename: input.file.name,
      mime_type: input.file.type || null,
      size_bytes: input.file.size,
      file_kind: kind,
      project_id: input.project_id?.trim() ? input.project_id.trim() : null,
      crm_organization_id: input.crm_organization_id?.trim() ? input.crm_organization_id.trim() : null,
      county_name: input.county_name?.trim() ? input.county_name.trim() : null,
      district_name: input.district_name?.trim() ? input.district_name.trim() : null,
      utility_name: input.utility_name?.trim() ? input.utility_name.trim() : null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  // Phase 5 (optional): best-effort indexing for AI document search.
  try {
    if ((data as any)?.id) {
      await fetch("/api/ai/index", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_table: "uploaded_files", source_id: (data as any).id }),
      });
    }
  } catch {
    // Ignore indexing errors to avoid breaking core upload flows.
  }

  return data as UploadedFileRow;
}

export async function deleteUploadedFile(supabase: SupabaseClient, row: Pick<UploadedFileRow, "id" | "bucket" | "path">) {
  const { error: storageError } = await supabase.storage.from(row.bucket).remove([row.path]);
  if (storageError) throw new Error(storageError.message);

  const { error: rowError } = await supabase.from("uploaded_files").delete().eq("id", row.id);
  if (rowError) throw new Error(rowError.message);
}

export async function downloadUploadedFile(
  supabase: SupabaseClient,
  row: Pick<UploadedFileRow, "bucket" | "path" | "filename">,
): Promise<File> {
  const { data, error } = await supabase.storage.from(row.bucket).download(row.path);
  if (error) throw new Error(error.message);
  return new File([data], row.filename, { type: data.type });
}
