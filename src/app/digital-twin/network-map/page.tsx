import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DigitalTwinNetworkMapPage } from "@/components/digital-twin-network-map-page";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalTwinNetworkMapRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <DigitalTwinNetworkMapPage />
    </AppShell>
  );
}
