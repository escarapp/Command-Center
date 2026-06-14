"use client";

import { jsPDF } from "jspdf";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createUtility, deleteUtility, fetchUtilities } from "@/lib/market-intelligence-api";
import type { UtilityProfileRow, UtilityType } from "@/types/phase7";

const UTILITY_TYPES: Array<{ value: UtilityType; label: string }> = [
  { value: "city", label: "Cities" },
  { value: "wsc", label: "WSCs" },
  { value: "irrigation_district", label: "Irrigation districts" },
  { value: "drainage_district", label: "Drainage districts" },
  { value: "industrial_user", label: "Industrial users" },
];

function generateUtilityPdf(row: UtilityProfileRow) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFontSize(16);
  doc.text("RGV Utility Profile", 40, 50);
  doc.setFontSize(11);
  doc.text(`Name: ${row.name}`, 40, 90);
  doc.text(`Type: ${row.utility_type}`, 40, 110);
  doc.text(`County: ${row.county ?? "n/a"}`, 40, 130);
  doc.text(`Service Area: ${row.service_area ?? "n/a"}`, 40, 150);
  doc.text(`Notes: ${row.notes ?? "n/a"}`, 40, 170);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 210);
  doc.save(`${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-utility-profile.pdf`);
}

export function MarketUtilitiesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<UtilityProfileRow[]>([]);
  const [name, setName] = useState("");
  const [utilityType, setUtilityType] = useState<UtilityType>("city");
  const [county, setCounty] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function reload() {
    try {
      setRows(await fetchUtilities(supabase));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Load failed: ${message}. Run supabase/phase7.sql.`);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleCreate() {
    setIsBusy(true);
    try {
      await createUtility(supabase, { name, utility_type: utilityType, county, service_area: serviceArea, notes });
      setName("");
      setCounty("");
      setServiceArea("");
      setNotes("");
      await reload();
      setStatus("Utility saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(row: UtilityProfileRow) {
    if (!window.confirm(`Delete utility ${row.name}?`)) return;
    setIsBusy(true);
    try {
      await deleteUtility(supabase, row.id);
      await reload();
      setStatus("Utility deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Market Intelligence · Utilities</h2>
      <p className="mt-1 text-xs text-slate-300">Track cities, WSCs, irrigation/drainage districts, and industrial users.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Utility name" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <select value={utilityType} onChange={(e) => setUtilityType(e.target.value as UtilityType)} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
          {UTILITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="Service area" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="md:col-span-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={isBusy || !name.trim()}
          className="rounded border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
        >
          Save Utility
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start justify-between gap-2 rounded border border-slate-700 bg-slate-900/30 px-3 py-2">
            <div className="text-xs text-slate-200">
              <p className="text-sm font-semibold text-slate-100">{row.name}</p>
              <p>{row.utility_type} · {row.county ?? "n/a"} · {row.service_area ?? "n/a"}</p>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => generateUtilityPdf(row)} className="rounded border border-teal-600 bg-teal-800/30 px-2 py-1 text-xs font-semibold text-teal-100">
                One-page PDF
              </button>
              <button type="button" onClick={() => void handleDelete(row)} className="rounded border border-rose-600 bg-rose-800/30 px-2 py-1 text-xs font-semibold text-rose-100">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
