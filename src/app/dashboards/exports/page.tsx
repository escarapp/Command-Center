import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardExportsPage } from "@/components/dashboard-exports-page";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardExportsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <DashboardExportsPage />
    </AppShell>
  );
}
