"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createDueDiligenceItem, fetchDueDiligence, fetchInvestors } from "@/lib/investor-portal-api";
import type { InvestorRow } from "@/types/phase8";

export function InvestorDueDiligencePage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<any[]>([]);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [investorId, setInvestorId] = useState("");
  const [item, setItem] = useState("");
  const [state, setState] = useState<"open" | "in_progress" | "closed">("open");
  const [party, setParty] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      const [d, i] = await Promise.all([fetchDueDiligence(supabase), fetchInvestors(supabase)]);
      setRows(d);
      setInvestors(i);
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
      await createDueDiligenceItem(supabase, {
        investor_id: investorId || null,
        project_id: null,
        item,
        status: state,
        responsible_party: party || null,
        due_date: dueDate || null,
        notes: notes || null,
      });
      setItem("");
      setParty("");
      setDueDate("");
      setNotes("");
      setState("open");
      await reload();
      setStatus("Due diligence item saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Investor Portal · Due Diligence</h2>
      <p className="mt-1 text-xs text-slate-300">Track open items, status, and responsible parties.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <select value={investorId} onChange={(e) => setInvestorId(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="">No assigned investor</option>
          {investors.map((i) => (
            <option key={i.id} value={i.id}>{i.display_name}</option>
          ))}
        </select>
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Open item" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <select value={state} onChange={(e) => setState(e.target.value as "open" | "in_progress" | "closed")} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="closed">Closed</option>
        </select>
        <input value={party} onChange={(e) => setParty(e.target.value)} placeholder="Responsible party" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void handleCreate()} disabled={!item.trim()} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
          Save Item
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
            <p className="text-sm font-semibold text-slate-100">{row.item}</p>
            <p>Status {row.status} · Responsible {row.responsible_party ?? "n/a"} · Due {row.due_date ?? "n/a"}</p>
          </div>
        ))}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
