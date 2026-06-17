"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  assignCompanyMemberByEmail,
  assignPlatformRoleByEmail,
  assignProjectMemberByEmail,
  fetchEmployeeDirectory,
  removeCompanyMember,
  removeProjectMember,
} from "@/lib/employee-admin-api";
import { fetchCompanies, fetchProjects } from "@/lib/projects-api";
import type {
  CompanyMemberRole,
  CompanyRow,
  EmployeeDirectoryRow,
  PlatformRole,
  ProjectAccessRole,
  ProjectRow,
} from "@/types/phase2";

const COMPANY_ROLE_OPTIONS: CompanyMemberRole[] = ["employee", "manager", "company_admin"];
const PROJECT_ROLE_OPTIONS: ProjectAccessRole[] = ["employee", "manager", "company_admin"];
const PLATFORM_ROLE_OPTIONS: PlatformRole[] = ["employee", "platform_manager"];

function formatRoleLabel(role: string) {
  return role.replaceAll("_", " ");
}

export function EmployeesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [directory, setDirectory] = useState<EmployeeDirectoryRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [currentRole, setCurrentRole] = useState<string>("employee");
  const [canManageEmployees, setCanManageEmployees] = useState(false);

  const [platformEmail, setPlatformEmail] = useState("");
  const [platformRole, setPlatformRole] = useState<PlatformRole>("employee");

  const [companyId, setCompanyId] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyRole, setCompanyRole] = useState<CompanyMemberRole>("employee");

  const [projectId, setProjectId] = useState("");
  const [projectEmail, setProjectEmail] = useState("");
  const [projectRole, setProjectRole] = useState<ProjectAccessRole>("employee");

  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  async function reload() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const [profileResult, companyRoleResult, projectRoleResult, directoryRows, companyRows, projectRows] = await Promise.all([
      supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase
        .from("company_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("member_role", ["company_admin", "manager"]),
      supabase
        .from("project_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("access_role", ["company_admin", "manager"]),
      fetchEmployeeDirectory(supabase),
      fetchCompanies(supabase),
      fetchProjects(supabase),
    ]);

    const nextRole = profileResult.data?.role ?? "employee";
    const hasPlatformScope = nextRole === "platform_manager" || nextRole === "admin";
    const hasManagerScope = (companyRoleResult.count ?? 0) > 0 || (projectRoleResult.count ?? 0) > 0;

    setCurrentRole(nextRole);
    setCanManageEmployees(hasPlatformScope || hasManagerScope);
    setDirectory(directoryRows);
    setCompanies(companyRows);
    setProjects(projectRows);

    if (!companyId && companyRows.length > 0) setCompanyId(companyRows[0].id);
    if (!projectId && projectRows.length > 0) setProjectId(projectRows[0].id);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePlatformAssign() {
    setIsBusy(true);
    try {
      await assignPlatformRoleByEmail(supabase, { email: platformEmail, role: platformRole });
      setStatusMessage("Platform role updated.");
      setPlatformEmail("");
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Platform role update failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCompanyAssign() {
    setIsBusy(true);
    try {
      await assignCompanyMemberByEmail(supabase, { companyId, email: companyEmail, role: companyRole });
      setStatusMessage("Company assignment updated.");
      setCompanyEmail("");
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Company assignment failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleProjectAssign() {
    setIsBusy(true);
    try {
      await assignProjectMemberByEmail(supabase, { projectId, email: projectEmail, role: projectRole });
      setStatusMessage("Project assignment updated.");
      setProjectEmail("");
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Project assignment failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemoveCompanyMember(nextCompanyId: string, userId: string) {
    setIsBusy(true);
    try {
      await removeCompanyMember(supabase, { companyId: nextCompanyId, userId });
      setStatusMessage("Company membership removed.");
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Could not remove company membership: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemoveProjectMember(nextProjectId: string, userId: string) {
    setIsBusy(true);
    try {
      await removeProjectMember(supabase, { projectId: nextProjectId, userId });
      setStatusMessage("Project membership removed.");
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Could not remove project membership: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  if (!canManageEmployees) {
    return (
      <div className="h-full overflow-y-auto bg-slate-950 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Employee Access</h2>
        <p className="mt-2 rounded border border-rose-700/70 bg-rose-900/20 p-3 text-sm text-rose-100">
          You do not have permission to open the Employees folder. Managers, company admins, and platform managers can access this area.
        </p>
      </div>
    );
  }

  const isPlatformManager = currentRole === "platform_manager" || currentRole === "admin";

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4 pb-8">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Employees & Access Control</h2>
      <p className="mt-1 text-xs text-slate-300">
        Assign platform roles, then map employees to company and project scopes. Employee users cannot access this page.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {isPlatformManager ? (
          <section className="rounded border border-white/10 bg-slate-900/40 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Platform Role Assignment</h3>
            <div className="mt-3 grid gap-2">
              <input
                value={platformEmail}
                onChange={(event) => setPlatformEmail(event.target.value)}
                placeholder="user@email.com"
                className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
              />
              <select
                value={platformRole}
                onChange={(event) => setPlatformRole(event.target.value as PlatformRole)}
                className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
              >
                {PLATFORM_ROLE_OPTIONS.map((roleOption) => (
                  <option key={roleOption} value={roleOption}>
                    {formatRoleLabel(roleOption)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handlePlatformAssign()}
                disabled={isBusy || !platformEmail.trim()}
                className="rounded-md border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
              >
                Save Platform Role
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded border border-white/10 bg-slate-900/40 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Platform Role Assignment</h3>
            <p className="mt-3 text-xs text-slate-400">Only platform managers can assign platform-wide roles.</p>
          </section>
        )}

        <section className="rounded border border-white/10 bg-slate-900/40 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Company Assignment</h3>
          <div className="mt-3 grid gap-2">
            <select
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            >
              {companies.length === 0 ? <option value="">No companies available</option> : null}
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <input
              value={companyEmail}
              onChange={(event) => setCompanyEmail(event.target.value)}
              placeholder="user@email.com"
              className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            />
            <select
              value={companyRole}
              onChange={(event) => setCompanyRole(event.target.value as CompanyMemberRole)}
              className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            >
              {COMPANY_ROLE_OPTIONS.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {formatRoleLabel(roleOption)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleCompanyAssign()}
              disabled={isBusy || !companyId || !companyEmail.trim()}
              className="rounded-md border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
            >
              Save Company Assignment
            </button>
          </div>
        </section>

        <section className="rounded border border-white/10 bg-slate-900/40 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Project Assignment</h3>
          <div className="mt-3 grid gap-2">
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            >
              {projects.length === 0 ? <option value="">No projects available</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <input
              value={projectEmail}
              onChange={(event) => setProjectEmail(event.target.value)}
              placeholder="user@email.com"
              className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            />
            <select
              value={projectRole}
              onChange={(event) => setProjectRole(event.target.value as ProjectAccessRole)}
              className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            >
              {PROJECT_ROLE_OPTIONS.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {formatRoleLabel(roleOption)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleProjectAssign()}
              disabled={isBusy || !projectId || !projectEmail.trim()}
              className="rounded-md border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
            >
              Save Project Assignment
            </button>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Employee Directory</h3>
        <div className="mt-3 space-y-3">
          {directory.length === 0 ? (
            <p className="text-xs text-slate-400">No visible employees yet.</p>
          ) : (
            directory.map((person) => (
              <article key={person.user_id} className="rounded border border-slate-700 bg-slate-950/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-100">{person.email}</h4>
                  <span className="rounded-full border border-cyan-500/40 bg-cyan-900/30 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                    Platform: {formatRoleLabel(person.platform_role)}
                  </span>
                </div>

                <div className="mt-2 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Companies</p>
                    {person.company_memberships.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-400">No company assignments.</p>
                    ) : (
                      <div className="mt-1 space-y-1">
                        {person.company_memberships.map((membership) => (
                          <div
                            key={`${person.user_id}-${membership.company_id}`}
                            className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/40 px-2 py-1"
                          >
                            <p className="min-w-0 truncate text-xs text-slate-200">
                              {membership.company_name} ({formatRoleLabel(membership.member_role)})
                            </p>
                            <button
                              type="button"
                              onClick={() => void handleRemoveCompanyMember(membership.company_id, person.user_id)}
                              disabled={isBusy}
                              className="rounded border border-rose-600 bg-rose-800/30 px-2 py-0.5 text-[11px] font-semibold text-rose-100 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Projects</p>
                    {person.project_memberships.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-400">No project assignments.</p>
                    ) : (
                      <div className="mt-1 space-y-1">
                        {person.project_memberships.map((membership) => (
                          <div
                            key={`${person.user_id}-${membership.project_id}`}
                            className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/40 px-2 py-1"
                          >
                            <p className="min-w-0 truncate text-xs text-slate-200">
                              {membership.project_name} ({formatRoleLabel(membership.access_role)})
                            </p>
                            <button
                              type="button"
                              onClick={() => void handleRemoveProjectMember(membership.project_id, person.user_id)}
                              disabled={isBusy}
                              className="rounded border border-rose-600 bg-rose-800/30 px-2 py-0.5 text-[11px] font-semibold text-rose-100 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {statusMessage ? (
        <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{statusMessage}</p>
      ) : null}
    </div>
  );
}
