import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CrmPage } from "@/components/crm-page";
import { createClient } from "@/lib/supabase/server";

export default async function CrmRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <CrmPage />
    </AppShell>
  );
}
