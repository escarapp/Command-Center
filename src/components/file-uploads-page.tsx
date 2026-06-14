"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProjects } from "@/lib/projects-api";
import { fetchOrganizations } from "@/lib/crm-api";
import { deleteUploadedFile, fetchUploadedFiles, uploadPlanningFile } from "@/lib/file-uploads-api";
import type { ProjectRow, OrganizationRow } from "@/types/phase2";
import type { UploadedFileRow } from "@/types/phase3";

const ACCEPT = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".geojson",
  ".json",
  ".kml",
  ".kmz",
  ".zip",
].join(",");

export function FileUploadsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [rows, setRows] = useState<UploadedFileRow[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [orgId, setOrgId] = useState<string>("");
  const [county, setCounty] = useState("");
  const [district, setDistrict] = useState("");
  const [utility, setUtility] = useState("");
  const [notes, setNotes] = useState("");

  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  async function reload() {
    const [p, o, f] = await Promise.all([fetchProjects(supabase), fetchOrganizations(supabase), fetchUploadedFiles(supabase)]);
    setProjects(p);
    setOrgs(o);
    setRows(f);
  }

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Load failed: ${message}. Did you run supabase/phase3.sql?`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload() {
    if (!file) {
      setStatus("Pick a file first.");
      return;
    }

    setIsBusy(true);
    try {
      await uploadPlanningFile(supabase, {
        file,
        project_id: projectId,
        crm_organization_id: orgId,
        county_name: county,
        district_name: district,
        utility_name: utility,
        notes,
      });
      setFile(null);
      setNotes("");
      await reload();
      setStatus("Uploaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Upload failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(row: UploadedFileRow) {
    const ok = window.confirm(`Delete "${row.filename}"?`);
    if (!ok) return;

    setIsBusy(true);
    try {
      await deleteUploadedFile(supabase, { id: row.id, bucket: row.bucket, path: row.path });
      await reload();
      setStatus("Deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">File Uploads</h2>
      <p className="mt-1 text-xs text-slate-300">Upload planning files to Supabase Storage and assign them to projects, utilities, districts, or counties.</p>

      <div className="mt-4 rounded border border-white/10 bg-slate-900/40 p-3">
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-200">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">Organization</label>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
              <option value="">None</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">County</label>
            <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">District</label>
            <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">Utility</label>
            <input value={utility} onChange={(e) => setUtility(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-semibold text-slate-200">File</label>
          <input
            type="file"
            accept={ACCEPT}
            disabled={isBusy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={isBusy || !file}
          className="mt-3 rounded-md border border-cyan-600 bg-cyan-800/40 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
        >
          {isBusy ? "Working..." : "Upload"}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-300">No uploaded files yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/30 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{row.filename}</p>
                <p className="text-xs text-slate-400">{row.file_kind.toUpperCase()} · {row.created_at}</p>
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

      {status ? <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
