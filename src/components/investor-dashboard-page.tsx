"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchInvestorDashboard, fetchInvestors, inviteInvestorByEmail } from "@/lib/investor-portal-api";
import type { InvestorDashboardRow, InvestorRow } from "@/types/phase8";

function money(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function InvestorDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<InvestorDashboardRow[]>([]);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState<InvestorRow["role"]>("investor");
  const [status, setStatus] = useState("");

  async function reload() {
    const [dash, inv] = await Promise.all([fetchInvestorDashboard(supabase), fetchInvestors(supabase)]);
    setRows(dash);
    setInvestors(inv);
  }

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Load failed: ${message}. Run supabase/phase8.sql.`);
      }
    })();
  }, [supabase]);

  async function handleInvite() {
    try {
      await inviteInvestorByEmail(supabase, {
        email,
        display_name: displayName,
        organization,
        role,
      });
      setEmail("");
      setDisplayName("");
      setOrganization("");
      setRole("investor");
      await reload();
      setStatus("Investor linked successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Invite failed: ${message}`);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Investor Portal · Dashboard</h2>
      <p className="mt-1 text-xs text-slate-300">Project overview, capacity, pipeline miles, revenue projection, and funding opportunities.</p>

      <div className="mt-4 overflow-x-auto rounded border border-white/10 bg-slate-900/30">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/60 text-slate-200">
            <tr>
              <th className="px-2 py-2 text-left">Project</th>
              <th className="px-2 py-2 text-left">Capacity (MGD)</th>
              <th className="px-2 py-2 text-left">Pipeline Miles</th>
              <th className="px-2 py-2 text-left">Revenue Projection</th>
              <th className="px-2 py-2 text-left">Funding Opportunities</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.project_id} className="border-t border-slate-700 text-slate-200">
                <td className="px-2 py-2 font-semibold text-slate-100">{row.project_name}</td>
                <td className="px-2 py-2">{Number(row.capacity_mgd).toFixed(2)}</td>
                <td className="px-2 py-2">{Number(row.pipeline_miles).toFixed(2)}</td>
                <td className="px-2 py-2">{money(Number(row.revenue_projection))}</td>
                <td className="px-2 py-2">{row.funding_program_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Invite Investor</p>
        <p className="mt-1 text-xs text-slate-300">Enter an existing Supabase auth email to link that user into this deal room.</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Investor email" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name (optional)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Organization (optional)" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value as InvestorRow["role"])} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
            <option value="investor">Investor</option>
            <option value="analyst">Analyst</option>
            <option value="admin">Admin</option>
          </select>
          <button type="button" onClick={() => void handleInvite()} disabled={!email.trim()} className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">
            Invite / Link Investor
          </button>
        </div>
      </div>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Investor Access List</p>
        <div className="mt-2 space-y-2">
          {investors.map((inv) => (
            <div key={inv.id} className="rounded border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs text-slate-200">
              <p className="text-sm font-semibold text-slate-100">{inv.display_name}</p>
              <p>{inv.role} · {inv.organization ?? "n/a"} · status {inv.status}</p>
            </div>
          ))}
        </div>
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
