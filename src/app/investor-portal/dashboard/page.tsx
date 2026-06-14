import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InvestorDashboardPage } from "@/components/investor-dashboard-page";
import { createClient } from "@/lib/supabase/server";

export default async function InvestorPortalDashboardRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <InvestorDashboardPage />
    </AppShell>
  );
}
