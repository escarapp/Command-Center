"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createFundingProgram, deleteFundingProgram, fetchFundingPrograms } from "@/lib/funding-api";
import type { FundingProgramRow } from "@/types/phase2";

export function FundingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<FundingProgramRow[]>([]);
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [deadline, setDeadline] = useState("");
  const [url, setUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);

  async function reload() {
    try {
      const next = await fetchFundingPrograms(supabase);
      setRows(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Load failed: ${message}. Did you run supabase/phase2.sql?`);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setIsBusy(true);
    try {
      await createFundingProgram(supabase, { name, agency, deadline, url });
      setName("");
      setAgency("");
      setDeadline("");
      setUrl("");
      await reload();
      setStatusMessage("Funding program created.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Create failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(row: FundingProgramRow) {
    const ok = window.confirm(`Delete funding program "${row.name}"?`);
    if (!ok) return;

    setIsBusy(true);
    try {
      await deleteFundingProgram(supabase, row.id);
      await reload();
      setStatusMessage("Funding program deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Funding</h2>
      <p className="mt-1 text-xs text-slate-300">Track funding programs, eligibility, and deadlines.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Program name"
          className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          placeholder="Agency"
          className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          placeholder="Deadline (YYYY-MM-DD)"
          className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (https://...)"
          className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={isBusy || !name.trim()}
          className="md:col-span-2 rounded-md border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
        >
          Add Program
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-300">No funding programs yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/30 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{row.name}</p>
                <p className="text-xs text-slate-400">
                  {row.agency ? `${row.agency} · ` : ""}
                  {row.deadline ? `Deadline: ${row.deadline}` : "No deadline"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(row)}
                disabled={isBusy}
                className="rounded border border-rose-600 bg-rose-800/30 px-2 py-1 text-xs font-semibold text-rose-100 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{statusMessage}</p>
      ) : null}
    </div>
  );
}
