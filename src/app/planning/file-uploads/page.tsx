import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FileUploadsPage } from "@/components/file-uploads-page";
import { createClient } from "@/lib/supabase/server";

export default async function FileUploadsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"}>
      <FileUploadsPage />
    </AppShell>
  );
}
