import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EngineeringEasementsPage } from "@/components/engineering-easements-page";
import { createClient } from "@/lib/supabase/server";

export default async function EngineeringEasementsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <EngineeringEasementsPage />
    </AppShell>
  );
}
