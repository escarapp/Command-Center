"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type AppShellProps = {
  userEmail: string;
  children: React.ReactNode;
};

const NAV_PRIMARY_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/dashboard", label: "Map" },
  { href: "/projects", label: "Projects" },
];

const NAV_MORE_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/crm", label: "CRM" },
  { href: "/funding", label: "Funding" },
  { href: "/documents", label: "Documents" },
  { href: "/ai", label: "AI" },
];

const PLANNING_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/planning/file-uploads", label: "File Uploads" },
  { href: "/planning/imported-layers", label: "Imported Layers" },
  { href: "/planning/map-overlays", label: "Map Overlays" },
  { href: "/planning/row-corridors", label: "ROW Corridors" },
  { href: "/planning/route-comparison", label: "Route Comparison" },
  { href: "/planning/cost-estimator", label: "Cost Estimator" },
  { href: "/planning/exports", label: "Exports" },
];

const DASHBOARD_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/dashboards/executive-summary", label: "Executive" },
  { href: "/dashboards/investor-snapshot", label: "Investor" },
  { href: "/dashboards/project-performance", label: "Performance" },
  { href: "/dashboards/legislative-briefs", label: "Legislative" },
  { href: "/dashboards/exports", label: "Exports" },
];

const ENGINEERING_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/engineering/parcels", label: "Parcels" },
  { href: "/engineering/easements", label: "Easements" },
  { href: "/engineering/row", label: "ROW" },
  { href: "/engineering/environmental", label: "Environmental" },
  { href: "/engineering/route-risk", label: "Route Risk" },
  { href: "/engineering/reports", label: "Reports" },
];

const MARKET_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/market-intelligence/utilities", label: "Utilities" },
  { href: "/market-intelligence/demand-forecasts", label: "Demand Forecasts" },
  { href: "/market-intelligence/growth-trends", label: "Growth Trends" },
  { href: "/market-intelligence/drought-risk", label: "Drought Risk" },
  { href: "/market-intelligence/opportunities", label: "Opportunities" },
  { href: "/market-intelligence/heat-maps", label: "Heat Maps" },
];

const INVESTOR_PORTAL_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/investor-portal/dashboard", label: "Dashboard" },
  { href: "/investor-portal/data-room", label: "Data Room" },
  { href: "/investor-portal/financial-models", label: "Financial Models" },
  { href: "/investor-portal/capital-stack", label: "Capital Stack" },
  { href: "/investor-portal/due-diligence", label: "Due Diligence" },
  { href: "/investor-portal/reports", label: "Reports" },
];

const DIGITAL_TWIN_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/digital-twin/network-map", label: "Network Map" },
  { href: "/digital-twin/simulations", label: "Simulations" },
  { href: "/digital-twin/capacity-planning", label: "Capacity Planning" },
  { href: "/digital-twin/forecasts", label: "Forecasts" },
  { href: "/digital-twin/executive-dashboard", label: "Executive Dashboard" },
  { href: "/digital-twin/ai-assistant", label: "AI Assistant" },
];

function classNames(...parts: Array<string | false>) {
  return parts.filter(Boolean).join(" ");
}

export function AppShell({ userEmail, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const planningActive = PLANNING_ITEMS.some((item) => item.href === pathname);
  const dashboardsActive = DASHBOARD_ITEMS.some((item) => item.href === pathname);
  const engineeringActive = ENGINEERING_ITEMS.some((item) => item.href === pathname);
  const marketActive = MARKET_ITEMS.some((item) => item.href === pathname);
  const investorPortalActive = INVESTOR_PORTAL_ITEMS.some((item) => item.href === pathname);
  const digitalTwinActive = DIGITAL_TWIN_ITEMS.some((item) => item.href === pathname);
  const moreActive = NAV_MORE_ITEMS.some((item) => item.href === pathname);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    supabase
      .from("user_profiles")
      .select("role")
      .single()
      .then(({ data }) => {
        setIsAdmin(data?.role === "admin");
      });
  }, [supabase]);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <header className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-slate-950/90 px-4 backdrop-blur">
        <div className="min-w-0 max-w-[240px] xl:max-w-[360px]">
          <h1 className="truncate text-sm font-semibold tracking-wide text-cyan-300">RGV Water GIS Command Center</h1>
          <p className="hidden truncate text-xs text-slate-300 xl:block">
            Private workspace for route planning and infrastructure intelligence
          </p>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_PRIMARY_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  "rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                    : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="relative">
            <details className="group">
              <summary
                className={classNames(
                  "flex cursor-pointer list-none items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                  moreActive
                    ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                    : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                )}
              >
                More
                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>

              <div className="absolute right-0 top-full z-30 mt-2 grid min-w-[190px] gap-1 rounded-lg border border-slate-700 bg-slate-950/95 p-2 shadow-lg backdrop-blur">
                {NAV_MORE_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        "rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                        active
                          ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                          : "border-slate-700 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          </div>

          <div className="relative">
            <details className="group">
              <summary
                className={classNames(
                  "flex cursor-pointer list-none items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                  planningActive
                    ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                    : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                )}
              >
                Planning
                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>

              <div className="absolute right-0 top-full z-30 mt-2 grid min-w-[210px] gap-1 rounded-lg border border-slate-700 bg-slate-950/95 p-2 shadow-lg backdrop-blur">
                {PLANNING_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        "rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                        active
                          ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                          : "border-slate-700 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          </div>

          <div className="relative">
            <details className="group">
              <summary
                className={classNames(
                  "flex cursor-pointer list-none items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                  dashboardsActive
                    ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                    : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                )}
              >
                Dashboards
                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>

              <div className="absolute right-0 top-full z-30 mt-2 grid min-w-[210px] gap-1 rounded-lg border border-slate-700 bg-slate-950/95 p-2 shadow-lg backdrop-blur">
                {DASHBOARD_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        "rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                        active
                          ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                          : "border-slate-700 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          </div>

          <div className="relative">
            <details className="group">
              <summary
                className={classNames(
                  "flex cursor-pointer list-none items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                  engineeringActive
                    ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                    : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                )}
              >
                Engineering
                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>

              <div className="absolute right-0 top-full z-30 mt-2 grid min-w-[210px] gap-1 rounded-lg border border-slate-700 bg-slate-950/95 p-2 shadow-lg backdrop-blur">
                {ENGINEERING_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        "rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                        active
                          ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                          : "border-slate-700 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          </div>

          <div className="relative">
            <details className="group">
              <summary
                className={classNames(
                  "flex cursor-pointer list-none items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                  marketActive
                    ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                    : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                )}
              >
                Market Intel
                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>

              <div className="absolute right-0 top-full z-30 mt-2 grid min-w-[220px] gap-1 rounded-lg border border-slate-700 bg-slate-950/95 p-2 shadow-lg backdrop-blur">
                {MARKET_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        "rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                        active
                          ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                          : "border-slate-700 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          </div>

          <div className="relative">
            <details className="group">
              <summary
                className={classNames(
                  "flex cursor-pointer list-none items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                  investorPortalActive
                    ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                    : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                )}
              >
                Investor Portal
                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>

              <div className="absolute right-0 top-full z-30 mt-2 grid min-w-[220px] gap-1 rounded-lg border border-slate-700 bg-slate-950/95 p-2 shadow-lg backdrop-blur">
                {INVESTOR_PORTAL_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        "rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                        active
                          ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                          : "border-slate-700 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          </div>

          <div className="relative">
            <details className="group">
              <summary
                className={classNames(
                  "flex cursor-pointer list-none items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                  digitalTwinActive
                    ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                    : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                )}
              >
                Digital Twin
                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>

              <div className="absolute right-0 top-full z-30 mt-2 grid min-w-[220px] gap-1 rounded-lg border border-slate-700 bg-slate-950/95 p-2 shadow-lg backdrop-blur">
                {DIGITAL_TWIN_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        "rounded-md border px-2 py-1.5 text-xs font-semibold transition",
                        active
                          ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                          : "border-slate-700 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          </div>
        </nav>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-md border border-slate-600 bg-slate-900/40 p-1.5 text-slate-100 transition hover:bg-slate-900 md:hidden"
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <span className="hidden max-w-[280px] truncate text-xs text-slate-300 sm:block">{userEmail}</span>
          {isAdmin && (
            <span className="hidden rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-950 sm:inline">
              Admin
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex items-center gap-2 rounded-md border border-slate-400/40 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-700 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      {mobileNavOpen ? (
        <div className="absolute inset-x-0 top-14 z-20 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-white/10 bg-slate-950/98 p-3 md:hidden">
          <div className="grid gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Main</p>
            {NAV_PRIMARY_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {NAV_MORE_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Planning Tools</p>
            {PLANNING_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Dashboards</p>
            {DASHBOARD_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Engineering</p>
            {ENGINEERING_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Market Intelligence</p>
            {MARKET_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Investor Portal</p>
            {INVESTOR_PORTAL_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Digital Twin</p>
            {DIGITAL_TWIN_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="h-full pt-14">{children}</div>
    </div>
  );
}
