import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MarketDemandForecastsPage } from "@/components/market-demand-forecasts-page";
import { createClient } from "@/lib/supabase/server";

export default async function MarketDemandForecastsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <MarketDemandForecastsPage />
    </AppShell>
  );
}
