import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompanyMemberRole,
  EmployeeCompanyMembership,
  EmployeeDirectoryRow,
  EmployeeProjectMembership,
  PlatformRole,
  ProjectAccessRole,
} from "@/types/phase2";

function normalizeCompanyMemberships(input: unknown): EmployeeCompanyMembership[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        company_id: String(row.company_id ?? ""),
        company_name: String(row.company_name ?? ""),
        member_role: (row.member_role as CompanyMemberRole) ?? "employee",
      };
    })
    .filter((row): row is EmployeeCompanyMembership => Boolean(row && row.company_id && row.company_name));
}

function normalizeProjectMemberships(input: unknown): EmployeeProjectMembership[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        project_id: String(row.project_id ?? ""),
        project_name: String(row.project_name ?? ""),
        access_role: (row.access_role as ProjectAccessRole) ?? "employee",
      };
    })
    .filter((row): row is EmployeeProjectMembership => Boolean(row && row.project_id && row.project_name));
}

export async function fetchEmployeeDirectory(supabase: SupabaseClient): Promise<EmployeeDirectoryRow[]> {
  const { data, error } = await supabase.rpc("list_accessible_employees");
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    user_id: String(row.user_id),
    email: String(row.email ?? "Unknown"),
    platform_role: (row.platform_role as PlatformRole) ?? "employee",
    company_memberships: normalizeCompanyMemberships(row.company_memberships),
    project_memberships: normalizeProjectMemberships(row.project_memberships),
  }));
}

export async function assignPlatformRoleByEmail(
  supabase: SupabaseClient,
  input: { email: string; role: PlatformRole },
): Promise<void> {
  const { error } = await supabase.rpc("upsert_platform_role_by_email", {
    p_email: input.email.trim(),
    p_role: input.role,
  });
  if (error) throw new Error(error.message);
}

export async function assignCompanyMemberByEmail(
  supabase: SupabaseClient,
  input: { companyId: string; email: string; role: CompanyMemberRole },
): Promise<void> {
  const { error } = await supabase.rpc("assign_company_member_by_email", {
    p_company_id: input.companyId,
    p_email: input.email.trim(),
    p_member_role: input.role,
  });
  if (error) throw new Error(error.message);
}

export async function assignProjectMemberByEmail(
  supabase: SupabaseClient,
  input: { projectId: string; email: string; role: ProjectAccessRole },
): Promise<void> {
  const { error } = await supabase.rpc("assign_project_member_by_email", {
    p_project_id: input.projectId,
    p_email: input.email.trim(),
    p_access_role: input.role,
  });
  if (error) throw new Error(error.message);
}

export async function removeCompanyMember(
  supabase: SupabaseClient,
  input: { companyId: string; userId: string },
): Promise<void> {
  const { error } = await supabase.rpc("remove_company_member_assignment", {
    p_company_id: input.companyId,
    p_user_id: input.userId,
  });
  if (error) throw new Error(error.message);
}

export async function removeProjectMember(
  supabase: SupabaseClient,
  input: { projectId: string; userId: string },
): Promise<void> {
  const { error } = await supabase.rpc("remove_project_member_assignment", {
    p_project_id: input.projectId,
    p_user_id: input.userId,
  });
  if (error) throw new Error(error.message);
}
