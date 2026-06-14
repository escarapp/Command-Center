import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createEmbedding } from "@/lib/ai/openai";

const RequestSchema = z.object({
  source_table: z.enum(["documents", "uploaded_files"]),
  source_id: z.string().uuid(),
  force: z.boolean().optional(),
});

function chunkText(input: string, opts?: { chunkSize?: number; overlap?: number; maxChunks?: number }) {
  const chunkSize = opts?.chunkSize ?? 1200;
  const overlap = opts?.overlap ?? 200;
  const maxChunks = opts?.maxChunks ?? 30;

  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [] as string[];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length && chunks.length < maxChunks) {
    const end = Math.min(text.length, start + chunkSize);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

async function extractPdfText(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = (pdfjs as any).getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const maxPages = Math.min(pdf.numPages ?? 0, 50);
  const parts: string[] = [];

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items ?? [])
      .map((it: any) => (typeof it?.str === "string" ? it.str : ""))
      .filter(Boolean)
      .join(" ");
    if (pageText.trim()) parts.push(pageText.trim());
  }

  return parts.join("\n\n");
}

function decodeText(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { source_table, source_id, force } = parsed.data;

    const sourceQuery = supabase
      .from(source_table)
      .select("id,bucket,path,filename,mime_type")
      .eq("id", source_id)
      .single();

    const { data: row, error: rowError } = await sourceQuery;
    if (rowError) return NextResponse.json({ error: rowError.message }, { status: 400 });

    const bucket = String((row as any).bucket);
    const path = String((row as any).path);
    const filename = String((row as any).filename ?? "");
    const mimeType = String((row as any).mime_type ?? "");

    if (!bucket || !path) {
      return NextResponse.json({ error: "Missing storage location on source row" }, { status: 400 });
    }

    const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
    if (signedError) return NextResponse.json({ error: signedError.message }, { status: 400 });

    const fileRes = await fetch(signed.signedUrl);
    if (!fileRes.ok) {
      return NextResponse.json({ error: `Failed to download file (${fileRes.status})` }, { status: 400 });
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    if (arrayBuffer.byteLength > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large to index (limit 15MB)" }, { status: 413 });
    }

    const bytes = new Uint8Array(arrayBuffer);

    let extractedText = "";
    const lowerName = filename.toLowerCase();

    if (mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
      extractedText = await extractPdfText(bytes);
    } else if (mimeType.startsWith("text/") || lowerName.endsWith(".txt") || lowerName.endsWith(".md") || lowerName.endsWith(".csv")) {
      extractedText = decodeText(bytes);
    } else {
      // Unsupported types: still allow a no-op response.
      extractedText = "";
    }

    const chunks = chunkText(extractedText, { chunkSize: 1200, overlap: 200, maxChunks: 30 });

    if (!chunks.length) {
      return NextResponse.json({
        ok: true,
        indexed_chunks: 0,
        note: "No extractable text found (or unsupported file type).",
      });
    }

    if (force) {
      const { error: delError } = await supabase
        .from("document_chunks")
        .delete()
        .eq("source_table", source_table)
        .eq("source_id", source_id);

      if (delError) {
        return NextResponse.json(
          { error: delError.message + " (If this table is missing, run supabase/phase5.sql.)" },
          { status: 400 },
        );
      }
    }

    const openAiKeyPresent = Boolean(process.env.OPENAI_API_KEY);

    const records = [] as any[];
    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      let embedding: number[] | null = null;

      if (openAiKeyPresent) {
        try {
          embedding = await createEmbedding({ text });
        } catch {
          embedding = null;
        }
      }

      records.push({
        source_table,
        source_id,
        bucket,
        path,
        chunk_index: i,
        content_text: text,
        embedding,
        metadata: {
          filename,
          mime_type: mimeType || null,
          extracted_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      });
    }

    const { error: upsertError } = await supabase
      .from("document_chunks")
      .upsert(records, { onConflict: "owner_id,source_table,source_id,chunk_index" });

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message + " (Did you run supabase/phase5.sql?)" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, indexed_chunks: chunks.length, embedded: openAiKeyPresent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
