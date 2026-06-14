import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InvestorCapitalStackPage } from "@/components/investor-capital-stack-page";
import { createClient } from "@/lib/supabase/server";

export default async function InvestorPortalCapitalStackRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <InvestorCapitalStackPage />
    </AppShell>
  );
}
