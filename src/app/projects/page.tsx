import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { ProjectsPage } from "@/components/projects-page";
import { ACTIVE_PROJECT_ID_COOKIE } from "@/lib/project-session";
import { fetchProjectById } from "@/lib/projects-api";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsRoute() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get(ACTIVE_PROJECT_ID_COOKIE)?.value ?? "";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const activeProject = activeProjectId ? await fetchProjectById(supabase, activeProjectId) : null;

  return (
    <AppShell userEmail={user.email ?? "Authenticated User"} activeProjectName={activeProject?.name}>
      <ProjectsPage />
    </AppShell>
  );
}
