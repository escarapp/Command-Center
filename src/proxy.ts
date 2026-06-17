import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { ACTIVE_PROJECT_ID_COOKIE } from "@/lib/project-session";

const ACTIVE_PROJECT_REQUIRED_PREFIXES = [
  "/dashboard",
  "/crm",
  "/funding",
  "/documents",
  "/planning",
  "/dashboards",
  "/engineering",
  "/market-intelligence",
  "/investor-portal",
  "/digital-twin",
  "/ai",
];

const INVESTOR_RESTRICTED_PREFIXES = [
  "/dashboard",
  "/crm",
  "/funding",
  "/documents",
  "/planning",
  "/dashboards",
  "/engineering",
  "/market-intelligence",
  "/digital-twin",
  "/ai",
  "/employees",
];

function pathMatches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { response, supabase, userId } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  if (userId && supabase) {
    const [profileResult, companyMemberResult, projectMemberResult, ownedCompanyResult, ownedProjectResult, investorResult] = await Promise.all([
      supabase.from("user_profiles").select("role").eq("id", userId).maybeSingle(),
      supabase.from("company_members").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("project_members").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("companies").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("investors").select("id", { count: "exact", head: true }).eq("investor_user_id", userId).eq("status", "active"),
    ]);

    const role = profileResult.data?.role ?? "employee";
    const isPlatformManager = role === "platform_manager" || role === "admin";
    const internalScopeCount =
      (companyMemberResult.count ?? 0) +
      (projectMemberResult.count ?? 0) +
      (ownedCompanyResult.count ?? 0) +
      (ownedProjectResult.count ?? 0);
    const isInvestorOnly = (investorResult.count ?? 0) > 0 && !isPlatformManager && internalScopeCount === 0;

    if (isInvestorOnly && pathMatches(pathname, INVESTOR_RESTRICTED_PREFIXES)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/investor-portal/dashboard";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  const needsActiveProject = pathMatches(pathname, ACTIVE_PROJECT_REQUIRED_PREFIXES);
  if (!needsActiveProject) {
    return response;
  }

  const activeProjectId = request.cookies.get(ACTIVE_PROJECT_ID_COOKIE)?.value;
  if (activeProjectId) {
    return response;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/projects";
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
