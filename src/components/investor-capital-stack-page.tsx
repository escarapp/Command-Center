"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchCapitalStack, upsertCapitalStack } from "@/lib/investor-portal-api";

function num(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function InvestorCapitalStackPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<any[]>([]);
  const [equity, setEquity] = useState("0");
  const [debt, setDebt] = useState("0");
  const [grants, setGrants] = useState("0");
  const [wifia, setWifia] = useState("0");
  const [swift, setSwift] = useState("0");
  const [twf, setTwf] = useState("0");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      setRows(await fetchCapitalStack(supabase));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase8.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleSave() {
    try {
      await upsertCapitalStack(supabase, {
        investor_id: null,
        project_id: null,
        equity: num(equity),
        debt: num(debt),
        grants: num(grants),
        wifia: num(wifia),
        swift: num(swift),
        texas_water_fund: num(twf),
        notes,
      });
      await reload();
      setStatus("Capital stack saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Investor Portal · Capital Stack</h2>
      <p className="mt-1 text-xs text-slate-300">Track equity, debt, grants, WIFIA, SWIFT, and Texas Water Fund sources.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <input value={equity} onChange={(e) => setEquity(e.target.value)} placeholder="Equity" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={debt} onChange={(e) => setDebt(e.target.value)} placeholder="Debt" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={grants} onChange={(e) => setGrants(e.target.value)} placeholder="Grants" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={wifia} onChange={(e) => setWifia(e.target.value)} placeholder="WIFIA" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={swift} onChange={(e) => setSwift(e.target.value)} placeholder="SWIFT" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={twf} onChange={(e) => setTwf(e.target.value)} placeholder="Texas Water Fund" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void handleSave()} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100">
          Save Capital Stack
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
            <p>Equity {Number(row.equity).toLocaleString()} · Debt {Number(row.debt).toLocaleString()} · Grants {Number(row.grants).toLocaleString()}</p>
            <p>WIFIA {Number(row.wifia).toLocaleString()} · SWIFT {Number(row.swift).toLocaleString()} · TWF {Number(row.texas_water_fund).toLocaleString()} · Total {Number(row.total_capital).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
