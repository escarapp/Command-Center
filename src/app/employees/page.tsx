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

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <EmployeesPage />
    </AppShell>
  );
}
