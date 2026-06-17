import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmployeesPage } from "@/components/employees-page";
import { createClient } from "@/lib/supabase/server";

export default async function EmployeesRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { count: companyScopeCount }, { count: projectScopeCount }] = await Promise.all([
    supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("member_role", ["company_admin", "manager"]),
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("access_role", ["company_admin", "manager"]),
  ]);

  const role = profile?.role ?? "employee";
  const isPlatformManager = role === "platform_manager" || role === "admin";
  const hasScopeManagerAccess = (companyScopeCount ?? 0) > 0 || (projectScopeCount ?? 0) > 0;

  if (!isPlatformManager && !hasScopeManagerAccess) {
    redirect("/dashboard");
  }

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <EmployeesPage />
    </AppShell>
  );
}
