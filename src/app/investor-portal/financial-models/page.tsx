import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InvestorFinancialModelsPage } from "@/components/investor-financial-models-page";
import { createClient } from "@/lib/supabase/server";

export default async function InvestorPortalFinancialModelsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <InvestorFinancialModelsPage />
    </AppShell>
  );
}
