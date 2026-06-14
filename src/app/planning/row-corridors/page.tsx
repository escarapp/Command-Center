import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RowCorridorsPage } from "@/components/row-corridors-page";
import { createClient } from "@/lib/supabase/server";

export default async function RowCorridorsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <RowCorridorsPage />
    </AppShell>
  );
}
