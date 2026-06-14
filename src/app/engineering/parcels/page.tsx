import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EngineeringParcelsPage } from "@/components/engineering-parcels-page";
import { createClient } from "@/lib/supabase/server";

export default async function EngineeringParcelsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <EngineeringParcelsPage />
    </AppShell>
  );
}
