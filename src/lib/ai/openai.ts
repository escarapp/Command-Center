export type OpenAIChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: Array<any> }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

export type OpenAIFunctionTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

function getOpenAIEnv() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const embeddingsModel = process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-small";

  return { apiKey, model, embeddingsModel };
}

export function assertOpenAIConfigured() {
  const { apiKey } = getOpenAIEnv();
  if (!apiKey) {
    const err = new Error("AI is not configured. Set OPENAI_API_KEY in your environment.");
    (err as any).statusCode = 503;
    throw err;
  }
}

export async function createChatCompletion(input: {
  messages: OpenAIChatMessage[];
  tools?: OpenAIFunctionTool[];
  temperature?: number;
}) {
  const { apiKey, model } = getOpenAIEnv();
  if (!apiKey) {
    const err = new Error("AI is not configured. Set OPENAI_API_KEY in your environment.");
    (err as any).statusCode = 503;
    throw err;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: input.temperature ?? 0.2,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.tools?.length ? "auto" : undefined,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const openAiError =
      data && typeof data === "object" && data !== null && "error" in data ? (data as any).error : null;
    const message =
      openAiError && typeof openAiError?.message === "string"
        ? openAiError.message
        : `OpenAI request failed (${res.status})`;
    const err = new Error(message);
    (err as any).statusCode = 502;
    (err as any).openai = {
      status: res.status,
      type: openAiError?.type ?? null,
      code: openAiError?.code ?? null,
      message: openAiError?.message ?? message,
    };
    throw err;
  }

  return data as any;
}

export async function createEmbedding(input: { text: string }) {
  const { apiKey, embeddingsModel } = getOpenAIEnv();
  if (!apiKey) {
    const err = new Error("AI is not configured. Set OPENAI_API_KEY in your environment.");
    (err as any).statusCode = 503;
    throw err;
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: embeddingsModel,
      input: input.text,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const openAiError =
      data && typeof data === "object" && data !== null && "error" in data ? (data as any).error : null;
    const message =
      openAiError && typeof openAiError?.message === "string"
        ? openAiError.message
        : `OpenAI embeddings request failed (${res.status})`;
    const err = new Error(message);
    (err as any).statusCode = 502;
    (err as any).openai = {
      status: res.status,
      type: openAiError?.type ?? null,
      code: openAiError?.code ?? null,
      message: openAiError?.message ?? message,
    };
    throw err;
  }

  const vector = data?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    throw new Error("Invalid embedding response from OpenAI");
  }

  return vector as number[];
}
