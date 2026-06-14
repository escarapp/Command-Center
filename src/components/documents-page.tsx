"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProjects } from "@/lib/projects-api";
import { deleteDocument, fetchDocuments, uploadDocument } from "@/lib/documents-api";
import type { DocumentRow, ProjectRow } from "@/types/phase2";

export function DocumentsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  async function reloadProjects() {
    const next = await fetchProjects(supabase);
    setProjects(next);
  }

  async function reloadDocuments(projectId: string) {
    if (!projectId) {
      setDocuments([]);
      return;
    }
    const next = await fetchDocuments(supabase, { entity_type: "project", entity_id: projectId });
    setDocuments(next);
  }

  useEffect(() => {
    (async () => {
      try {
        await reloadProjects();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatusMessage(`Load failed: ${message}. Did you run supabase/phase2.sql?`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reloadDocuments(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  async function handleUpload(file: File) {
    if (!selectedProjectId) {
      setStatusMessage("Pick a project first.");
      return;
    }

    setIsBusy(true);
    try {
      await uploadDocument(supabase, { entity_type: "project", entity_id: selectedProjectId, file });
      await reloadDocuments(selectedProjectId);
      setStatusMessage("Uploaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Upload failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(row: DocumentRow) {
    const ok = window.confirm(`Delete "${row.filename}"?`);
    if (!ok) return;

    setIsBusy(true);
    try {
      await deleteDocument(supabase, { id: row.id, path: row.path });
      await reloadDocuments(selectedProjectId);
      setStatusMessage("Deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(`Delete failed: ${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Documents</h2>
      <p className="mt-1 text-xs text-slate-300">Upload and manage documents in Supabase Storage.</p>

      <div className="mt-4 grid gap-2 rounded border border-white/10 bg-slate-900/40 p-3 md:grid-cols-[1fr_1fr]">
        <div>
          <label className="block text-xs font-semibold text-slate-200">Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">Uploads are stored under `documents/project/&lt;project_id&gt;/...`.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-200">Upload</label>
          <input
            type="file"
            disabled={isBusy || !selectedProjectId}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.currentTarget.value = "";
            }}
            className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">Pick a project to enable uploads.</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {!selectedProjectId ? (
          <p className="text-xs text-slate-300">Select a project to view documents.</p>
        ) : documents.length === 0 ? (
          <p className="text-xs text-slate-300">No documents yet for this project.</p>
        ) : (
          documents.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/30 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{row.filename}</p>
                <p className="text-xs text-slate-400">{row.created_at}</p>
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
