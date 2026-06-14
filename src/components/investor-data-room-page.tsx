"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createInvestorDocument, fetchInvestorDocuments, fetchInvestors } from "@/lib/investor-portal-api";
import type { InvestorDocumentType, InvestorRow } from "@/types/phase8";

const DOC_TYPES: Array<{ value: InvestorDocumentType; label: string }> = [
  { value: "financial_model", label: "Financial models" },
  { value: "engineering_report", label: "Engineering reports" },
  { value: "permit", label: "Permits" },
  { value: "presentation", label: "Presentations" },
  { value: "contract", label: "Contracts" },
  { value: "study", label: "Studies" },
];

export function InvestorDataRoomPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<any[]>([]);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [investorId, setInvestorId] = useState("");
  const [docType, setDocType] = useState<InvestorDocumentType>("financial_model");
  const [filename, setFilename] = useState("");
  const [path, setPath] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [docs, inv] = await Promise.all([fetchInvestorDocuments(supabase), fetchInvestors(supabase)]);
      setRows(docs);
      setInvestors(inv);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase8.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleCreate() {
    try {
      await createInvestorDocument(supabase, {
        investor_id: investorId || null,
        project_id: null,
        doc_type: docType,
        bucket: "documents",
        path,
        filename,
        notes,
      });
      setFilename("");
      setPath("");
      setNotes("");
      await reload();
      setStatus("Data room document saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Investor Portal · Data Room</h2>
      <p className="mt-1 text-xs text-slate-300">Track financial models, engineering reports, permits, presentations, contracts, and studies.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <select value={investorId} onChange={(e) => setInvestorId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">Shared with all investors</option>
          {investors.map((i) => (
            <option key={i.id} value={i.id}>{i.display_name} ({i.role})</option>
          ))}
        </select>
        <select value={docType} onChange={(e) => setDocType(e.target.value as InvestorDocumentType)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          {DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <input value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="Filename" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="Storage path" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void handleCreate()} disabled={!filename.trim() || !path.trim()} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
          Save Data Room Item
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
            <p className="text-sm font-semibold text-slate-100">{row.filename}</p>
            <p>{row.doc_type} · {row.path}</p>
          </div>
        ))}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
