"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchBestExpansionRoutes,
  fetchDigitalTwinFundingOpportunities,
  fetchFutureShortagesByCounty,
  fetchHighestDemandUtility,
} from "@/lib/digital-twin-api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function normalize(input: string) {
  return input.trim().toLowerCase();
}

export function DigitalTwinAiAssistantPage() {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Digital Twin assistant is online. Ask: best expansion route, highest-demand utility, future shortages by county, or funding opportunities.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function answerQuestion(question: string): Promise<string> {
    const q = normalize(question);

    if (q.includes("best expansion route")) {
      const routes = await fetchBestExpansionRoutes(supabase);
      const best = routes[0];
      if (!best) return "No expansion candidates found. Add planned network connections and set them as expansion candidates.";
      return `Best expansion route is ${best.from_node} to ${best.to_node} (${best.connection_type}) with score ${Number(best.route_score).toFixed(2)}, capacity ${Number(best.capacity_mgd).toFixed(2)} MGD, and length ${Number(best.length_miles).toFixed(2)} miles.`;
    }

    if (q.includes("highest-demand utility") || q.includes("highest demand utility")) {
      const rows = await fetchHighestDemandUtility(supabase);
      const top = rows[0];
      if (!top) return "No demand models found. Add utility demand models in the Forecasts section.";
      return `Highest-demand utility is ${top.utility_name} in ${top.county} with projected 20-year demand of ${Number(top.projected_demand_20y_mgd).toFixed(2)} MGD.`;
    }

    if (q.includes("future shortages") || q.includes("shortages by county")) {
      const rows = await fetchFutureShortagesByCounty(supabase);
      if (!rows.length) return "No county shortages are currently projected.";
      return rows
        .slice(0, 8)
        .map((r, idx) => `${idx + 1}. ${r.county}: ${Number(r.shortage_mgd).toFixed(2)} MGD shortage`)
        .join("\n");
    }

    if (q.includes("funding")) {
      const rows = await fetchDigitalTwinFundingOpportunities(supabase);
      if (!rows.length) return "No active funding opportunities were found.";
      return rows
        .slice(0, 6)
        .map((r, idx) => `${idx + 1}. ${r.program_name} (${r.category}) - ${r.rationale}`)
        .join("\n");
    }

    return "Try one of these prompts: Show best expansion route. Show highest-demand utility. Show future shortages by county. Show funding opportunities.";
  }

  async function handleSend(prefill?: string) {
    const question = (prefill ?? input).trim();
    if (!question || isBusy) return;

    setInput("");
    setStatus("");
    setIsBusy(true);
    setMessages((prev) => [...prev, { role: "user", content: question }]);

    try {
      const answer = await answerQuestion(question);
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(message);
      setMessages((prev) => [...prev, { role: "assistant", content: `I could not answer that: ${message}` }]);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="h-full bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Digital Twin · AI Assistant</h2>
      <p className="mt-1 text-xs text-slate-300">Planning assistant for expansion routing, demand prioritization, shortage analysis, and funding pathways.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleSend("Show best expansion route") } className="rounded border border-slate-600 bg-slate-900/40 px-2 py-1 text-xs text-slate-100">Best expansion route</button>
        <button type="button" onClick={() => void handleSend("Show highest-demand utility") } className="rounded border border-slate-600 bg-slate-900/40 px-2 py-1 text-xs text-slate-100">Highest-demand utility</button>
        <button type="button" onClick={() => void handleSend("Show future shortages by county") } className="rounded border border-slate-600 bg-slate-900/40 px-2 py-1 text-xs text-slate-100">Future shortages by county</button>
        <button type="button" onClick={() => void handleSend("Show funding opportunities") } className="rounded border border-slate-600 bg-slate-900/40 px-2 py-1 text-xs text-slate-100">Funding opportunities</button>
      </div>

      <div className="mt-4 grid h-[calc(100vh-12rem)] gap-3 rounded border border-white/10 bg-slate-900/30 p-3">
        <div ref={listRef} className="min-h-0 overflow-y-auto rounded border border-slate-700 bg-slate-950/40 p-3">
          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.role === "user" ? "max-w-[80ch] rounded border border-cyan-400/30 bg-cyan-900/20 px-3 py-2 text-sm text-slate-100" : "max-w-[80ch] rounded border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-100"}>
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
            rows={2}
            placeholder="Ask a Digital Twin planning question..."
            className="w-full resize-none rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={isBusy}
          />
          <button type="button" onClick={() => void handleSend()} disabled={!input.trim() || isBusy} className="rounded border border-cyan-500 bg-cyan-900/30 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50">
            {isBusy ? "Thinking..." : "Send"}
          </button>
        </div>

        {status ? <p className="rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">{status}</p> : null}
      </div>
    </div>
  );
}
