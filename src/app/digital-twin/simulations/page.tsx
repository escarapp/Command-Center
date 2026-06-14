import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DigitalTwinSimulationsPage } from "@/components/digital-twin-simulations-page";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalTwinSimulationsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <DigitalTwinSimulationsPage />
    </AppShell>
  );
}
