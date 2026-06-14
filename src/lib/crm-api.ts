import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationRow } from "@/types/phase2";

export async function fetchOrganizations(supabase: SupabaseClient): Promise<OrganizationRow[]> {
  const { data, error } = await supabase
    .from("crm_organizations")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationRow[];
}

export async function createOrganization(
  supabase: SupabaseClient,
  input: { name: string; org_type?: string; notes?: string },
): Promise<OrganizationRow> {
  const name = input.name.trim();
  if (!name) throw new Error("Organization name is required");

  const { data, error } = await supabase
    .from("crm_organizations")
    .insert({
      name,
      org_type: input.org_type?.trim() ? input.org_type.trim() : "utility",
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as OrganizationRow;
}

export async function deleteOrganization(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("crm_organizations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
