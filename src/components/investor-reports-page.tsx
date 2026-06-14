"use client";

import { jsPDF } from "jspdf";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createInvestorReport, fetchInvestorReports } from "@/lib/investor-portal-api";
import type { InvestorReportType } from "@/types/phase8";

const REPORT_LABELS: Record<InvestorReportType, string> = {
  executive_summary: "Executive Summary",
  investment_memorandum: "Investment Memorandum",
  financial_summary: "Financial Summary",
};

function generatePdf(title: string, reportType: InvestorReportType, notes: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFontSize(18);
  doc.text(title, 40, 50);
  doc.setFontSize(11);
  doc.text(`Type: ${REPORT_LABELS[reportType]}`, 40, 85);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 105);
  doc.text("RGV Water Investor Portal", 40, 125);
  const lines = doc.splitTextToSize(notes || "Summary generated from investor portal datasets.", 520);
  doc.text(lines, 40, 160);
  doc.save(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
}

export function InvestorReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<any[]>([]);
  const [reportType, setReportType] = useState<InvestorReportType>("executive_summary");
  const [title, setTitle] = useState("Investor Report");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      setRows(await fetchInvestorReports(supabase));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase8.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleGenerate() {
    try {
      generatePdf(title, reportType, notes);
      await createInvestorReport(supabase, {
        report_type: reportType,
        title,
        parameters: { source: "investor-portal" },
      });
      await reload();
      setStatus("Report generated and logged.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Generate failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Investor Portal · Reports</h2>
      <p className="mt-1 text-xs text-slate-300">Generate Executive Summary, Investment Memorandum, and Financial Summary PDFs.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <select value={reportType} onChange={(e) => setReportType(e.target.value as InvestorReportType)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          {Object.entries(REPORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Report title" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Report notes" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void handleGenerate()} disabled={!title.trim()} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
          Generate Report PDF
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
            <p className="text-sm font-semibold text-slate-100">{row.title ?? "(untitled)"}</p>
            <p>{row.report_type} · {new Date(row.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
