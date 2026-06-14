import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MarketDroughtRiskPage } from "@/components/market-drought-risk-page";
import { createClient } from "@/lib/supabase/server";

export default async function MarketDroughtRiskRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <MarketDroughtRiskPage />
    </AppShell>
  );
}
