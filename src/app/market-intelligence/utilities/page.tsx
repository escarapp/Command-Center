import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MarketUtilitiesPage } from "@/components/market-utilities-page";
import { createClient } from "@/lib/supabase/server";

export default async function MarketUtilitiesRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <MarketUtilitiesPage />
    </AppShell>
  );
}
