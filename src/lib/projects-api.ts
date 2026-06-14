import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectRow, ProjectPriority } from "@/types/phase2";

export async function fetchProjects(supabase: SupabaseClient): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectRow[];
}

export async function createProject(
  supabase: SupabaseClient,
  input: { name: string; priority?: ProjectPriority; status?: string; notes?: string },
): Promise<ProjectRow> {
  const name = input.name.trim();
  if (!name) throw new Error("Project name is required");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      priority: input.priority ?? "low",
      status: input.status ?? "idea",
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ProjectRow;
}

export async function deleteProject(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
