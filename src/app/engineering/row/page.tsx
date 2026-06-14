import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EngineeringRowPage } from "@/components/engineering-row-page";
import { createClient } from "@/lib/supabase/server";

export default async function EngineeringRowRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <EngineeringRowPage />
    </AppShell>
  );
}
