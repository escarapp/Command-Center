import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard-shell";
import { ACTIVE_PROJECT_ID_COOKIE } from "@/lib/project-session";
import { fetchProjectById } from "@/lib/projects-api";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get(ACTIVE_PROJECT_ID_COOKIE)?.value ?? "";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!activeProjectId) {
    redirect("/projects");
  }

  const activeProject = await fetchProjectById(supabase, activeProjectId);
  if (!activeProject) {
    redirect("/projects");
  }

  return <DashboardShell userEmail={user.email ?? "Authenticated User"} activeProjectName={activeProject.name} />;
}
