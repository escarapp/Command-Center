import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MapOverlaysPage } from "@/components/map-overlays-page";
import { createClient } from "@/lib/supabase/server";

export default async function MapOverlaysRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <MapOverlaysPage />
    </AppShell>
  );
}
