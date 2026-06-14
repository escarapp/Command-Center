"use client";

import { jsPDF } from "jspdf";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createEngineeringReport,
  deleteEngineeringReport,
  fetchEngineeringReports,
  fetchRouteRiskScores,
} from "@/lib/engineering-api";
import type { EngineeringReportRow, EngineeringReportType } from "@/types/phase6";

const REPORT_LABELS: Record<EngineeringReportType, string> = {
  route_summary_pdf: "Route Summary PDF",
  crossing_report: "Crossing Report",
  environmental_constraint_report: "Environmental Constraint Report",
  easement_report: "Easement Report",
};

type RouteOption = { id: string; name: string; project_id: string };
type ProjectOption = { id: string; name: string };

function buildReportBody(title: string, rows: any[], type: EngineeringReportType): string[] {
  const lines: string[] = [];
  lines.push(title);
  lines.push(`Report Type: ${REPORT_LABELS[type]}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");

  if (rows.length === 0) {
    lines.push("No route risk data found for the selected scope.");
    return lines;
  }

  for (const row of rows) {
    lines.push(`Route: ${row.route_name}`);
    lines.push(`Length (mi): ${Number(row.length_miles ?? 0).toFixed(2)}`);
    lines.push(`Estimated Cost: ${Number(row.estimated_cost ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`);
    lines.push(`Environmental Risk: ${row.environmental_risk}`);
    lines.push(`ROW Complexity: ${row.row_complexity}`);
    lines.push(`Crossings: ${row.crossing_count}`);
    lines.push(`Land Acquisition Needs: ${row.land_acquisition_needs}`);
    lines.push(`Easement Requirements: ${row.easement_requirements}`);
    lines.push(`Total Risk Score: ${row.total_risk_score}`);
    lines.push("");
  }
  return lines;
}

function downloadPdf(title: string, lines: string[]) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const lineHeight = 14;

  let y = margin;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, width);
    for (const part of wrapped) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(part, margin, y);
      y += lineHeight;
    }
  }

  const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  doc.save(`${safe || "engineering-report"}.pdf`);
}

export function EngineeringReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<EngineeringReportRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [reportType, setReportType] = useState<EngineeringReportType>("route_summary_pdf");
  const [title, setTitle] = useState("Engineering Report");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function reload() {
    try {
      const [reportRows, projectsRes, routesRes] = await Promise.all([
        fetchEngineeringReports(supabase),
        supabase.from("projects").select("id,name").order("updated_at", { ascending: false }).limit(500),
        supabase.from("route_alternatives").select("id,name,project_id").order("updated_at", { ascending: false }).limit(1000),
      ]);

      if (projectsRes.error) throw new Error(projectsRes.error.message);
      if (routesRes.error) throw new Error(routesRes.error.message);

      setRows(reportRows);
      setProjects((projectsRes.data ?? []) as ProjectOption[]);
      setRoutes((routesRes.data ?? []) as RouteOption[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase6.sql.`);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    setIsBusy(true);
    try {
      const riskRows = await fetchRouteRiskScores(supabase, projectId || undefined);
      const scoped = routeId ? riskRows.filter((r) => r.route_alternative_id === routeId) : riskRows;
      const lines = buildReportBody(title, scoped, reportType);
      downloadPdf(title, lines);

      await createEngineeringReport(supabase, {
        report_type: reportType,
        route_alternative_id: routeId || null,
        project_id: projectId || null,
        title,
        parameters: { route_count: scoped.length, generated_from: "phase6-engineering-reports" },
        notes,
        status: "generated",
      });

      await reload();
      setStatus("PDF generated and report logged.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Report generation failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this report log entry?")) return;
    setIsBusy(true);
    try {
      await deleteEngineeringReport(supabase, id);
      await reload();
      setStatus("Report entry deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Engineering · Reports</h2>
      <p className="mt-1 text-xs text-slate-300">Generate Route Summary, Crossing, Environmental Constraint, and Easement PDF reports.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <select value={reportType} onChange={(e) => setReportType(e.target.value as EngineeringReportType)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          {Object.entries(REPORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Report title" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />

        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">All routes in scope</option>
          {routes.filter((r) => !projectId || r.project_id === projectId).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isBusy || !title.trim()}
          className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
        >
          Generate PDF Report
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
            <p className="truncate">{REPORT_LABELS[row.report_type]} · {row.title ?? "(untitled)"} · {new Date(row.created_at).toLocaleString()}</p>
            <button
              type="button"
              onClick={() => void handleDelete(row.id)}
              disabled={isBusy}
              className="rounded border border-rose-600 bg-rose-800/30 px-2 py-1 font-semibold text-rose-100 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
