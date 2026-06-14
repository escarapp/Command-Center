import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MarketOpportunitiesPage } from "@/components/market-opportunities-page";
import { createClient } from "@/lib/supabase/server";

export default async function MarketOpportunitiesRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <MarketOpportunitiesPage />
    </AppShell>
  );
}
