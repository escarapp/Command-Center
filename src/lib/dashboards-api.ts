import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectRow, ProjectPriority } from "@/types/phase2";
import type { RouteCostEstimateRow } from "@/types/phase3";

export type DashboardProjectRow = Pick<
  ProjectRow,
  "id" | "name" | "estimated_mgd" | "revenue" | "priority" | "status" | "updated_at"
>;

export type LatestCostEstimateByProject = Record<string, RouteCostEstimateRow>;

export function computeCapexTotalFromEstimate(row: RouteCostEstimateRow): number | null {
  const baseInputs = [
    row.pipeline_miles,
    row.cost_per_mile,
    row.pump_station_cost,
    row.storage_tank_cost,
    row.land_easement_cost,
  ];

  const hasAnyBaseInput = baseInputs.some((v) => v != null);
  if (!hasAnyBaseInput) return null;

  const miles = row.pipeline_miles ?? 0;
  const cpm = row.cost_per_mile ?? 0;
  const pump = row.pump_station_cost ?? 0;
  const tank = row.storage_tank_cost ?? 0;
  const land = row.land_easement_cost ?? 0;

  const base = miles * cpm + pump + tank + land;

  const eng = row.engineering_design_pct ?? 0;
  const perm = row.permitting_environmental_pct ?? 0;
  const cont = row.contingency_pct ?? 0;
  const pct = (eng + perm + cont) / 100;

  return base * (1 + pct);
}

export async function fetchDashboardProjects(
  supabase: SupabaseClient,
  projectId?: string,
): Promise<DashboardProjectRow[]> {
  const scopedProjectId = projectId?.trim();

  let query = supabase
    .from("projects")
    .select("id,name,estimated_mgd,revenue,priority,status,updated_at")
    .order("updated_at", { ascending: false });

  if (scopedProjectId) {
    query = query.eq("id", scopedProjectId);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as DashboardProjectRow[];
}

export async function fetchLatestCostEstimatesByProject(
  supabase: SupabaseClient,
  projectId?: string,
): Promise<LatestCostEstimateByProject> {
  const scopedProjectId = projectId?.trim();

  let query = supabase
    .from("route_cost_estimates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (scopedProjectId) {
    query = query.eq("project_id", scopedProjectId);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RouteCostEstimateRow[];
  const latest: LatestCostEstimateByProject = {};
  for (const row of rows) {
    if (!latest[row.project_id]) latest[row.project_id] = row;
  }
  return latest;
}

export function countByStatus(projects: DashboardProjectRow[]): Record<string, number> {
  return projects.reduce<Record<string, number>>((acc, project) => {
    const key = project.status || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function countByPriority(projects: DashboardProjectRow[]): Record<ProjectPriority, number> {
  const base: Record<ProjectPriority, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const project of projects) {
    const priority = (project.priority as ProjectPriority | null) ?? "low";
    if (priority in base) base[priority] += 1;
  }

  return base;
}
