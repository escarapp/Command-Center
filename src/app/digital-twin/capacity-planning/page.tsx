import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DigitalTwinCapacityPlanningPage } from "@/components/digital-twin-capacity-planning-page";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalTwinCapacityPlanningRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <DigitalTwinCapacityPlanningPage />
    </AppShell>
  );
}
