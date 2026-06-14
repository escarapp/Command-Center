"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask me about projects, route alternatives, ROW corridors, stakeholders (CRM), funding programs, and indexed documents. I’ll use your Supabase data when available.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    if (!canSend) return;

    const nextUserMessage: ChatMessage = { role: "user", content: input.trim() };
    setInput("");
    setStatusMessage("");
    setIsSending(true);
    setMessages((prev) => [...prev, nextUserMessage]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [...messages, nextUserMessage] }),
      });

      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as any).error)
            : `Request failed (${res.status})`;
        throw new Error(message);
      }

      if (!payload || typeof payload !== "object" || payload === null || !("message" in payload)) {
        throw new Error("Invalid response from /api/ai/chat");
      }

      const assistantText = String((payload as any).message ?? "");
      setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusMessage(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I couldn't complete that request. ${message}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="h-full bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">AI Water Intelligence</h2>
      <p className="mt-1 text-xs text-slate-300">
        Chat assistant that can query your Supabase workspace. If AI is not configured, the API will return an error.
      </p>

      <div className="mt-4 grid h-[calc(100vh-10.5rem)] gap-3 rounded border border-white/10 bg-slate-900/30 p-3">
        <div ref={listRef} className="min-h-0 overflow-y-auto rounded border border-slate-700 bg-slate-950/40 p-3">
          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80ch] rounded border border-cyan-400/30 bg-cyan-900/20 px-3 py-2 text-sm text-slate-100"
                      : "max-w-[80ch] rounded border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-100"
                  }
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            rows={2}
            className="w-full resize-none rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={isSending}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="rounded border border-cyan-500 bg-cyan-900/30 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </div>

        <p className="text-[11px] text-slate-400">Tip: Press Ctrl/⌘ + Enter to send.</p>

        {statusMessage ? (
          <p className="rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{statusMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
