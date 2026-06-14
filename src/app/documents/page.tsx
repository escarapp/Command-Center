import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DocumentsPage } from "@/components/documents-page";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <DocumentsPage />
    </AppShell>
  );
}
