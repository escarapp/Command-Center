import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DigitalTwinForecastsPage } from "@/components/digital-twin-forecasts-page";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalTwinForecastsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <DigitalTwinForecastsPage />
    </AppShell>
  );
}
