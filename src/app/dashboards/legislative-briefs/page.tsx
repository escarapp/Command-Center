import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LegislativeBriefsPage } from "@/components/legislative-briefs-page";
import { createClient } from "@/lib/supabase/server";

export default async function LegislativeBriefsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <LegislativeBriefsPage />
    </AppShell>
  );
}
