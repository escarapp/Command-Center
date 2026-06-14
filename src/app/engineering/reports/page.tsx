import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EngineeringReportsPage } from "@/components/engineering-reports-page";
import { createClient } from "@/lib/supabase/server";

export default async function EngineeringReportsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <EngineeringReportsPage />
    </AppShell>
  );
}
