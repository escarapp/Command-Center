import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MarketGrowthTrendsPage } from "@/components/market-growth-trends-page";
import { createClient } from "@/lib/supabase/server";

export default async function MarketGrowthTrendsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <MarketGrowthTrendsPage />
    </AppShell>
  );
}
