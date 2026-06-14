import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EngineeringRouteRiskPage } from "@/components/engineering-route-risk-page";
import { createClient } from "@/lib/supabase/server";

export default async function EngineeringRouteRiskRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <EngineeringRouteRiskPage />
    </AppShell>
  );
}
