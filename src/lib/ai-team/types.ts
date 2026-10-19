export type AIAgentStatus = "idle" | "working" | "waiting" | "failed";

export type AIAgent = {
  id: string;
  agent_key: string;
  display_name: string;
  role_description: string;
  system_instructions: string;
  permissions: string[];
  provider: string;
  model: string;
  status: AIAgentStatus;
  enabled: boolean;
  last_active_at: string | null;
  last_error: string | null;
};

export type AIConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIJSONSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

export type AIToolDefinition = {
  name: string;
  description: string;
  permission: string;
  approvalRequired: boolean;
  strict?: boolean;
  parameters: AIJSONSchema;
};

export type AIToolCall = {
  id: string;
  name: string;
  arguments: unknown;
};

export type AIProviderRunRequest = {
  model: string;
  instructions: string;
  messages: AIConversationMessage[];
  tools: AIToolDefinition[];
  enableWebSearch?: boolean;
  maxOutputTokens: number;
  maxProviderRounds: number;
  safetyIdentifier: string;
  executeTool: (call: AIToolCall) => Promise<unknown>;
};

export type AIProviderRunResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  providerRequestId: string | null;
};

export interface AIProviderAdapter {
  readonly provider: string;
  run(request: AIProviderRunRequest): Promise<AIProviderRunResult>;
}
