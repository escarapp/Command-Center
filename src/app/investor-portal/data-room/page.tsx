import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InvestorDataRoomPage } from "@/components/investor-data-room-page";
import { createClient } from "@/lib/supabase/server";

export default async function InvestorPortalDataRoomRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <InvestorDataRoomPage />
    </AppShell>
  );
}
