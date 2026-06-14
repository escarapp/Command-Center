"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchFinancialModels, upsertFinancialModel } from "@/lib/investor-portal-api";

const SCENARIOS = [25, 50, 100, 150] as const;

function num(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function InvestorFinancialModelsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<any[]>([]);
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]>(25);
  const [annualSales, setAnnualSales] = useState("0");
  const [om, setOm] = useState("0");
  const [debt, setDebt] = useState("0");
  const [assumptions, setAssumptions] = useState("");
  const [status, setStatus] = useState("");

  async function reload() {
    try {
      setRows(await fetchFinancialModels(supabase));
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
      await upsertFinancialModel(supabase, {
        investor_id: null,
        project_id: null,
        scenario_mgd: scenario,
        annual_sales: num(annualSales),
        om_costs: num(om),
        debt_service: num(debt),
        assumptions,
      });
      await reload();
      setStatus("Financial model saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Investor Portal · Financial Models</h2>
      <p className="mt-1 text-xs text-slate-300">Scenario models for 25/50/100/150 MGD with annual sales, O&M, debt service, and cash flow.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <select value={String(scenario)} onChange={(e) => setScenario(Number(e.target.value) as (typeof SCENARIOS)[number])} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          {SCENARIOS.map((s) => (
            <option key={s} value={s}>{s} MGD Scenario</option>
          ))}
        </select>
        <input value={annualSales} onChange={(e) => setAnnualSales(e.target.value)} placeholder="Annual sales" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={om} onChange={(e) => setOm(e.target.value)} placeholder="O&M costs" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={debt} onChange={(e) => setDebt(e.target.value)} placeholder="Debt service" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} rows={2} placeholder="Assumptions" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void handleSave()} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100">
          Save Model
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-200">
            <p className="text-sm font-semibold text-slate-100">{row.scenario_mgd} MGD</p>
            <p>Annual sales {Number(row.annual_sales).toLocaleString()} · O&M {Number(row.om_costs).toLocaleString()} · Debt {Number(row.debt_service).toLocaleString()} · Cash flow {Number(row.cash_flow).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
