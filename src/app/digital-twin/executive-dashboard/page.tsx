import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DigitalTwinExecutiveDashboardPage } from "@/components/digital-twin-executive-dashboard-page";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalTwinExecutiveDashboardRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <DigitalTwinExecutiveDashboardPage />
    </AppShell>
  );
}
