import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DigitalTwinAiAssistantPage } from "@/components/digital-twin-ai-assistant-page";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalTwinAiAssistantRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <DigitalTwinAiAssistantPage />
    </AppShell>
  );
}
