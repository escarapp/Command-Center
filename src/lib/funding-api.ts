import type { SupabaseClient } from "@supabase/supabase-js";
import type { FundingProgramRow } from "@/types/phase2";

export async function fetchFundingPrograms(supabase: SupabaseClient, projectId: string): Promise<FundingProgramRow[]> {
  const project_id = projectId.trim();
  if (!project_id) return [];

  const { data, error } = await supabase
    .from("funding_programs")
    .select("*")
    .eq("project_id", project_id)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as FundingProgramRow[];
}

export async function createFundingProgram(
  supabase: SupabaseClient,
  input: { project_id: string; name: string; agency?: string; deadline?: string; url?: string; eligibility?: string; notes?: string },
): Promise<FundingProgramRow> {
  const project_id = input.project_id.trim();
  const name = input.name.trim();
  if (!project_id) throw new Error("Active project is required");
  if (!name) throw new Error("Program name is required");

  const deadline = input.deadline?.trim() ? input.deadline.trim() : null;
  const url = input.url?.trim() ? input.url.trim() : null;

  const { data, error } = await supabase
    .from("funding_programs")
    .insert({
      project_id,
      name,
      agency: input.agency?.trim() ? input.agency.trim() : null,
      eligibility: input.eligibility?.trim() ? input.eligibility.trim() : null,
      deadline,
      url,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as FundingProgramRow;
}

export async function deleteFundingProgram(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("funding_programs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
