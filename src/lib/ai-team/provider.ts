import type {
  AIProviderAdapter,
  AIProviderRunRequest,
  AIProviderRunResult,
} from "./types";

type OpenAIOutputItem = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: Array<{ type?: string; text?: string }>;
};

type OpenAIResponse = {
  id?: string;
  output?: OpenAIOutputItem[];
  output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

type OpenAIErrorPayload = {
  error?: { code?: unknown; type?: unknown };
};

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

function responseText(response: OpenAIResponse) {
  if (response.output_text?.trim()) return response.output_text.trim();
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function normalizedProviderErrorCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
  return normalized || null;
}

function openAIErrorCode(details: string) {
  try {
    const payload = JSON.parse(details) as OpenAIErrorPayload;
    return (
      normalizedProviderErrorCode(payload.error?.code) ||
      normalizedProviderErrorCode(payload.error?.type)
    );
  } catch {
    return null;
  }
}

function openAIErrorMessage(status: number, code: string | null) {
  const suffix = code ? `: ${code}` : "";
  if (status === 401) {
    return `OpenAI authentication failed (${status}${suffix}). Replace the server-side OPENAI_API_KEY secret.`;
  }
  if (status === 403) {
    return `OpenAI authorization failed (${status}${suffix}). Check the API project's model and endpoint permissions.`;
  }
  if (status === 429) {
    return `OpenAI rate limit or quota was reached (${status}${suffix}).`;
  }
  return `OpenAI request failed (${status}${suffix}).`;
}

class OpenAIResponsesAdapter implements AIProviderAdapter {
  readonly provider = "openai";

  constructor(private readonly apiKey: string) {}

  async run(request: AIProviderRunRequest): Promise<AIProviderRunResult> {
    const input: unknown[] = request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    let inputTokens = 0;
    let outputTokens = 0;
    let providerRequestId: string | null = null;

    for (let round = 0; round < request.maxProviderRounds; round += 1) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          instructions: request.instructions,
          input,
          tools: [
            ...(request.enableWebSearch
              ? [{ type: "web_search", search_context_size: "medium" }]
              : []),
            ...request.tools.map((tool) => ({
              type: "function",
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              strict: tool.strict !== false,
            })),
          ],
          max_output_tokens: request.maxOutputTokens,
          parallel_tool_calls: false,
          reasoning: { effort: "low" },
          safety_identifier: request.safetyIdentifier,
          store: false,
        }),
        signal: AbortSignal.timeout(45_000),
      });

      if (!response.ok) {
        const details = (await response.text()).slice(0, 4000);
        const providerCode = openAIErrorCode(details);
        throw new AIProviderError(
          openAIErrorMessage(response.status, providerCode),
          providerCode ? `openai_${providerCode}` : `openai_${response.status}`,
        );
      }

      const payload = (await response.json()) as OpenAIResponse;
      providerRequestId = payload.id || providerRequestId;
      inputTokens += payload.usage?.input_tokens || 0;
      outputTokens += payload.usage?.output_tokens || 0;
      input.push(...(payload.output || []));

      const calls = (payload.output || []).filter(
        (item) =>
          item.type === "function_call" &&
          item.call_id &&
          item.name &&
          item.arguments,
      );
      if (calls.length === 0) {
        const text = responseText(payload);
        if (!text) {
          throw new AIProviderError(
            "The provider returned no message",
            "empty_response",
          );
        }
        return { text, inputTokens, outputTokens, providerRequestId };
      }

      if (round === request.maxProviderRounds - 1) {
        throw new AIProviderError(
          "The AI tool-call limit was reached",
          "tool_limit",
        );
      }

      for (const item of calls) {
        let parsedArguments: unknown;
        try {
          parsedArguments = JSON.parse(item.arguments || "{}");
        } catch {
          parsedArguments = {};
        }
        let result: unknown;
        try {
          result = await request.executeTool({
            id: item.call_id || crypto.randomUUID(),
            name: item.name || "unknown",
            arguments: parsedArguments,
          });
        } catch (error) {
          result = {
            ok: false,
            error: "tool_execution_failed",
            message:
              error instanceof Error
                ? error.message.slice(0, 2_000)
                : "The tool could not be executed",
          };
        }
        input.push({
          type: "function_call_output",
          call_id: item.call_id,
          output: JSON.stringify(result).slice(0, 16_000),
        });
      }
    }

    throw new AIProviderError(
      "The AI provider round limit was reached",
      "round_limit",
    );
  }
}

export function createAIProvider(provider: string): AIProviderAdapter {
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("The OpenAI provider is not configured");
    return new OpenAIResponsesAdapter(apiKey);
  }
  throw new Error(`The ${provider} AI provider is not configured`);
}

export function estimateTokens(value: unknown) {
  return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}

export async function privacySafeIdentifier(actorId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`akipasa-ai:${actorId}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
