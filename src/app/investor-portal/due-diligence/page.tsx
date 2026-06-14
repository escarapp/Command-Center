import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InvestorDueDiligencePage } from "@/components/investor-due-diligence-page";
import { createClient } from "@/lib/supabase/server";

export default async function InvestorPortalDueDiligenceRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <InvestorDueDiligencePage />
    </AppShell>
  );
}
