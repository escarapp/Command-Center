import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createChatCompletion, type OpenAIFunctionTool, type OpenAIChatMessage } from "@/lib/ai/openai";

const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

const SYSTEM_PROMPT =
  "You are the RGV Water GIS Command Center AI assistant. You can answer questions using the user's Supabase workspace via provided tools. " +
  "Rules: (1) Do not invent data. If you cannot find something via tools, say so. " +
  "(2) When you use tools, summarize results and mention table/record names where possible. " +
  "(3) Keep responses concise and action-oriented. " +
  "(4) Do not output secrets or environment variables.";

type ToolContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
};

function toolError(message: string) {
  return { ok: false as const, error: message };
}

function toolOk<T>(data: T) {
  return { ok: true as const, data };
}

function isInsufficientQuotaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const openai = (error as any).openai;
  const code = openai?.code;
  const message = String((error as any).message ?? "");
  return code === "insufficient_quota" || message.toLowerCase().includes("insufficient_quota");
}

async function fallbackReply(ctx: ToolContext, userText: string) {
  const text = userText.toLowerCase();

  // Minimal intent routing for common, high-value asks.
  if (text.includes("project") && (text.includes("list") || text.includes("show") || text.includes("what"))) {
    const result = await runTool(ctx, "list_projects", { limit: 25 });
    if (!result.ok) return `I can’t list projects right now: ${result.error}`;

    const projects = (result.data as any).projects as Array<any>;
    if (!projects?.length) return "No projects found in your workspace.";

    const lines = projects.map((p) => `- ${p.name} (${p.status ?? "status unknown"}, ${p.priority ?? "priority unknown"})`);
    return `Here are your recent projects:\n${lines.join("\n")}`;
  }

  if (text.includes("funding") && (text.includes("deadline") || text.includes("due"))) {
    const result = await runTool(ctx, "upcoming_funding_deadlines", { days: 60 });
    if (!result.ok) return `I can’t load funding deadlines right now: ${result.error}`;

    const programs = (result.data as any).funding_programs as Array<any>;
    if (!programs?.length) return "No upcoming funding deadlines found (next 60 days).";

    const lines = programs.map((p) => `- ${p.name} (${p.agency ?? ""}) — deadline: ${p.deadline ?? "n/a"}`.trim());
    return `Funding programs with deadlines in the next 60 days:\n${lines.join("\n")}`;
  }

  return (
    "OpenAI is currently returning an insufficient quota error, so I can’t run the full AI assistant. " +
    "I *can* still do a couple basics without OpenAI, like: “Show my projects” or “Funding deadlines”."
  );
}

async function runTool(ctx: ToolContext, name: string, args: any) {
  const supabase = ctx.supabase;

  switch (name) {
    case "search_all": {
      const query = String(args?.query ?? "").trim();
      const limit = Number.isFinite(args?.limit) ? Math.max(1, Math.min(25, Number(args.limit))) : 10;
      if (!query) return toolError("Missing query");

      const [projects, orgs, programs, docs, uploads] = await Promise.all([
        supabase.from("projects").select("id,name,status,priority,updated_at").ilike("name", `%${query}%`).limit(limit),
        supabase.from("crm_organizations").select("id,name,org_type,updated_at").ilike("name", `%${query}%`).limit(limit),
        supabase.from("funding_programs").select("id,name,agency,deadline,url,updated_at").ilike("name", `%${query}%`).limit(limit),
        supabase.from("documents").select("id,filename,entity_type,entity_id,created_at").ilike("filename", `%${query}%`).limit(limit),
        supabase.from("uploaded_files").select("id,filename,file_kind,created_at").ilike("filename", `%${query}%`).limit(limit),
      ]);

      return toolOk({
        query,
        projects: projects.data ?? [],
        organizations: orgs.data ?? [],
        funding_programs: programs.data ?? [],
        documents: docs.data ?? [],
        planning_uploads: uploads.data ?? [],
        errors: {
          projects: projects.error?.message ?? null,
          organizations: orgs.error?.message ?? null,
          funding_programs: programs.error?.message ?? null,
          documents: docs.error?.message ?? null,
          planning_uploads: uploads.error?.message ?? null,
        },
      });
    }

    case "list_projects": {
      const limit = Number.isFinite(args?.limit) ? Math.max(1, Math.min(50, Number(args.limit))) : 25;
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,status,priority,updated_at")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) return toolError(error.message);
      return toolOk({ projects: data ?? [] });
    }

    case "get_project": {
      const projectId = String(args?.project_id ?? "").trim();
      if (!projectId) return toolError("Missing project_id");

      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (error) return toolError(error.message);
      return toolOk({ project: data });
    }

    case "list_route_alternatives": {
      const projectId = String(args?.project_id ?? "").trim();
      if (!projectId) return toolError("Missing project_id");

      const { data, error } = await supabase
        .from("route_alternatives")
        .select("id,project_id,name,cost_per_mile,crossings,easement_concerns,permitting_concerns,environmental_concerns,notes,updated_at")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) return toolError(error.message);
      return toolOk({ routes: data ?? [] });
    }

    case "rank_routes": {
      const projectId = String(args?.project_id ?? "").trim();
      const criteria = String(args?.criteria ?? "cheapest").trim();
      if (!projectId) return toolError("Missing project_id");

      const { data, error } = await supabase.rpc("rank_route_alternatives", { p_project_id: projectId, p_criteria: criteria });
      if (error) return toolError(
        error.message +
          " (If this function is missing, run supabase/phase5.sql.)",
      );
      return toolOk({ ranked_routes: data ?? [] });
    }

    case "upcoming_funding_deadlines": {
      const days = Number.isFinite(args?.days) ? Math.max(1, Math.min(365, Number(args.days))) : 60;
      const agency = String(args?.agency ?? "").trim();

      const now = new Date();
      const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const endIso = end.toISOString().slice(0, 10);

      let query = supabase
        .from("funding_programs")
        .select("id,name,agency,deadline,url,notes")
        .not("deadline", "is", null)
        .lte("deadline", endIso)
        .order("deadline", { ascending: true })
        .limit(50);

      if (agency) query = query.ilike("agency", `%${agency}%`);

      const { data, error } = await query;
      if (error) return toolError(error.message);
      return toolOk({ days, funding_programs: data ?? [] });
    }

    case "search_documents": {
      const q = String(args?.query ?? "").trim();
      const limit = Number.isFinite(args?.limit) ? Math.max(1, Math.min(25, Number(args.limit))) : 8;
      if (!q) return toolError("Missing query");

      const { data, error } = await supabase
        .from("document_chunks")
        .select("id,source_table,source_id,bucket,path,chunk_index,metadata,content_text")
        .textSearch("content_tsv", q, { type: "plain", config: "english" })
        .limit(limit);

      if (error) {
        return toolError(error.message + " (If this table is missing, run supabase/phase5.sql and index a document.)");
      }

      const snippets = (data ?? []).map((row: any) => ({
        id: row.id,
        source_table: row.source_table,
        source_id: row.source_id,
        path: row.path,
        chunk_index: row.chunk_index,
        metadata: row.metadata,
        snippet: String(row.content_text ?? "").slice(0, 500),
      }));

      return toolOk({ query: q, results: snippets });
    }

    case "list_imported_layers": {
      const limit = Number.isFinite(args?.limit) ? Math.max(1, Math.min(50, Number(args.limit))) : 25;
      const { data, error } = await supabase
        .from("imported_layers")
        .select("id,name,default_visible,updated_at")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) return toolError(error.message);
      return toolOk({ layers: data ?? [] });
    }

    case "gis_near_route": {
      const routeAlternativeId = String(args?.route_alternative_id ?? "").trim();
      const miles = Number.isFinite(args?.miles) ? Math.max(0.01, Math.min(50, Number(args.miles))) : 1;
      const target = String(args?.target ?? "imported_layer").trim();
      const limit = Number.isFinite(args?.limit) ? Math.max(1, Math.min(500, Number(args.limit))) : 200;

      if (!routeAlternativeId) return toolError("Missing route_alternative_id");

      if (target === "gis_features") {
        const layerKey = args?.layer_key ? String(args.layer_key) : null;
        const { data, error } = await supabase.rpc("find_gis_features_near_route", {
          p_route_alternative_id: routeAlternativeId,
          p_miles: miles,
          p_layer_key: layerKey,
          p_limit: limit,
        });
        if (error) return toolError(error.message + " (Run supabase/phase5.sql to add GIS helper RPCs.)");
        return toolOk({ target, miles, results: data ?? [] });
      }

      const importedLayerId = String(args?.imported_layer_id ?? "").trim();
      if (!importedLayerId) return toolError("Missing imported_layer_id (required when target=imported_layer)");

      const { data, error } = await supabase.rpc("find_imported_geometries_near_route", {
        p_route_alternative_id: routeAlternativeId,
        p_imported_layer_id: importedLayerId,
        p_miles: miles,
        p_limit: limit,
      });

      if (error) return toolError(error.message + " (Run supabase/phase5.sql to add GIS helper RPCs.)");
      return toolOk({ target, miles, imported_layer_id: importedLayerId, results: data ?? [] });
    }

    case "gis_intersect_corridor": {
      const rowCorridorId = String(args?.row_corridor_id ?? "").trim();
      const importedLayerId = String(args?.imported_layer_id ?? "").trim();
      const limit = Number.isFinite(args?.limit) ? Math.max(1, Math.min(500, Number(args.limit))) : 200;
      if (!rowCorridorId) return toolError("Missing row_corridor_id");
      if (!importedLayerId) return toolError("Missing imported_layer_id");

      const { data, error } = await supabase.rpc("find_imported_geometries_intersect_corridor", {
        p_row_corridor_id: rowCorridorId,
        p_imported_layer_id: importedLayerId,
        p_limit: limit,
      });

      if (error) return toolError(error.message + " (Run supabase/phase5.sql to add GIS helper RPCs.)");
      return toolOk({ results: data ?? [] });
    }

    case "gis_assets_within_polygon": {
      const polygonImportedGeometryId = String(args?.polygon_imported_geometry_id ?? "").trim();
      const layerKey = args?.layer_key ? String(args.layer_key) : null;
      const limit = Number.isFinite(args?.limit) ? Math.max(1, Math.min(500, Number(args.limit))) : 200;
      if (!polygonImportedGeometryId) return toolError("Missing polygon_imported_geometry_id");

      const { data, error } = await supabase.rpc("find_gis_features_within_imported_polygon", {
        p_polygon_imported_geometry_id: polygonImportedGeometryId,
        p_layer_key: layerKey,
        p_limit: limit,
      });

      if (error) return toolError(error.message + " (Run supabase/phase5.sql to add GIS helper RPCs.)");
      return toolOk({ results: data ?? [] });
    }

    default:
      return toolError(`Unknown tool: ${name}`);
  }
}

const TOOLS: OpenAIFunctionTool[] = [
  {
    type: "function",
    function: {
      name: "search_all",
      description: "Search projects, organizations, funding programs, documents, and planning uploads by name/filename.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List recent projects.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project",
      description: "Fetch a single project by id.",
      parameters: {
        type: "object",
        properties: { project_id: { type: "string" } },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_route_alternatives",
      description: "List route alternatives for a project.",
      parameters: {
        type: "object",
        properties: { project_id: { type: "string" } },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rank_routes",
      description: "Rank route alternatives for a project using Phase 5 RPC (shortest, cheapest, lowest_risk).",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          criteria: { type: "string" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upcoming_funding_deadlines",
      description: "List funding programs with deadlines within N days.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number" },
          agency: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_documents",
      description: "Search indexed document chunks (requires Phase 5 indexing).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_imported_layers",
      description: "List imported GIS layers.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gis_near_route",
      description:
        "Spatial query: find imported geometries or GIS features within N miles of a route alternative.",
      parameters: {
        type: "object",
        properties: {
          route_alternative_id: { type: "string" },
          miles: { type: "number" },
          target: { type: "string", description: "imported_layer | gis_features" },
          imported_layer_id: { type: "string" },
          layer_key: { type: "string" },
          limit: { type: "number" },
        },
        required: ["route_alternative_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gis_intersect_corridor",
      description: "Spatial query: find imported geometries that intersect a ROW corridor.",
      parameters: {
        type: "object",
        properties: {
          row_corridor_id: { type: "string" },
          imported_layer_id: { type: "string" },
          limit: { type: "number" },
        },
        required: ["row_corridor_id", "imported_layer_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gis_assets_within_polygon",
      description: "Spatial query: find GIS features within an imported polygon geometry (e.g., a county boundary feature).",
      parameters: {
        type: "object",
        properties: {
          polygon_imported_geometry_id: { type: "string" },
          layer_key: { type: "string" },
          limit: { type: "number" },
        },
        required: ["polygon_imported_geometry_id"],
      },
    },
  },
];

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

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const chatMessages: OpenAIChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content } as OpenAIChatMessage)),
    ];

    const ctx: ToolContext = { supabase };

    for (let i = 0; i < 3; i++) {
      let completion: any;
      try {
        completion = await createChatCompletion({ messages: chatMessages, tools: TOOLS, temperature: 0.2 });
      } catch (error) {
        if (isInsufficientQuotaError(error)) {
          const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
          const fallback = await fallbackReply(ctx, lastUser);
          const message =
            `${fallback}\n\n` +
            `Note: OpenAI is returning “insufficient_quota”, which means the OpenAI account used by this app currently has no API credits / billing enabled.`;
          return NextResponse.json({
            message,
            warning:
              "OpenAI quota exceeded (insufficient_quota). Enable billing/credits in your OpenAI account, then restart the dev server.",
          });
        }
        throw error;
      }
      const message = completion?.choices?.[0]?.message;
      if (!message) throw new Error("Missing completion message");

      chatMessages.push(message);

      const toolCalls = message.tool_calls as Array<any> | undefined;
      if (toolCalls && toolCalls.length) {
        for (const call of toolCalls) {
          const toolName = call?.function?.name;
          const toolCallId = call?.id;
          const rawArgs = call?.function?.arguments;

          if (!toolName || !toolCallId) continue;

          let args: any = {};
          try {
            args = rawArgs ? JSON.parse(rawArgs) : {};
          } catch {
            args = {};
          }

          const result = await runTool(ctx, toolName, args);
          chatMessages.push({
            role: "tool",
            tool_call_id: toolCallId,
            name: toolName,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      const content = String(message.content ?? "").trim();
      if (!content) {
        return NextResponse.json({ message: "I don't have an answer for that yet." });
      }

      return NextResponse.json({ message: content });
    }

    return NextResponse.json({ message: "I couldn't complete that request (tool loop limit)." }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode = error && typeof error === "object" && (error as any).statusCode ? Number((error as any).statusCode) : 500;
    const openai = error && typeof error === "object" ? (error as any).openai : null;
    if (openai?.code === "insufficient_quota") {
      return NextResponse.json(
        {
          error:
            "OpenAI quota exceeded (insufficient_quota). Enable billing/credits in your OpenAI account, then restart the dev server.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
