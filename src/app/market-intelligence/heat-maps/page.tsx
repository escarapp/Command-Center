import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MarketHeatMapsPage } from "@/components/market-heat-maps-page";
import { createClient } from "@/lib/supabase/server";

export default async function MarketHeatMapsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <MarketHeatMapsPage />
    </AppShell>
  );
}
