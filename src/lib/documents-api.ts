import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentRow } from "@/types/phase2";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function fetchDocuments(
  supabase: SupabaseClient,
  input: { entity_type: string; entity_id: string },
): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("entity_type", input.entity_type)
    .eq("entity_id", input.entity_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

export async function uploadDocument(
  supabase: SupabaseClient,
  input: { entity_type: string; entity_id: string; file: File },
): Promise<void> {
  const safeName = sanitizeFilename(input.file.name);
  const objectPath = `${input.entity_type}/${input.entity_id}/${crypto.randomUUID()}_${safeName}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(objectPath, input.file, {
    upsert: false,
    contentType: input.file.type || undefined,
  });

  if (uploadError) throw new Error(uploadError.message);

  const { data: row, error: rowError } = await supabase
    .from("documents")
    .insert({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      bucket: "documents",
      path: objectPath,
      filename: input.file.name,
      mime_type: input.file.type || null,
      size_bytes: input.file.size,
    })
    .select("id")
    .single();

  if (rowError) throw new Error(rowError.message);

  // Phase 5 (optional): best-effort indexing for AI document search.
  try {
    if (row?.id) {
      await fetch("/api/ai/index", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_table: "documents", source_id: row.id }),
      });
    }
  } catch {
    // Ignore indexing errors to avoid breaking core upload flows.
  }
}

export async function deleteDocument(supabase: SupabaseClient, row: Pick<DocumentRow, "id" | "path">): Promise<void> {
  const { error: storageError } = await supabase.storage.from("documents").remove([row.path]);
  if (storageError) throw new Error(storageError.message);

  const { error: rowError } = await supabase.from("documents").delete().eq("id", row.id);
  if (rowError) throw new Error(rowError.message);
}
