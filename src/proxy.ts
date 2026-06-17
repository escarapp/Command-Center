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

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const needsActiveProject = ACTIVE_PROJECT_REQUIRED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
