import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EngineeringEnvironmentalPage } from "@/components/engineering-environmental-page";
import { createClient } from "@/lib/supabase/server";

export default async function EngineeringEnvironmentalRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <EngineeringEnvironmentalPage />
    </AppShell>
  );
}
