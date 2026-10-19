import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AIAgent, AIToolCall, AIToolDefinition } from "./types";

const toolDefinitions: AIToolDefinition[] = [
  {
    name: "crm_workspace_overview",
    description:
      "Summarize the active AkiHQ CRM workspace: pipeline value, leads, contacts, companies, tasks, projects, invoices, and campaigns. Use this as the primary operational overview.",
    permission: "crm:workspace:read",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "crm_search_workspace",
    description:
      "Search a bounded set of AkiHQ CRM records by type and text. Returns operational fields from the active workspace only.",
    permission: "crm:records:read",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: [
            "deal",
            "lead",
            "contact",
            "company",
            "task",
            "project",
            "campaign",
            "conversation",
            "event",
            "product",
            "invoice",
            "page",
            "form",
            "automation",
            "employee",
            "article",
          ],
        },
        query: { type: "string", minLength: 1, maxLength: 120 },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
      required: ["entity_type", "query", "limit"],
      additionalProperties: false,
    },
  },
  {
    name: "crm_get_workspace_record",
    description:
      "Read one AkiHQ CRM record from the active workspace by type and ID, including its bounded operational fields.",
    permission: "crm:records:read",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: [
            "deal",
            "lead",
            "contact",
            "company",
            "task",
            "project",
            "campaign",
            "conversation",
            "event",
            "product",
            "invoice",
            "page",
            "form",
            "automation",
            "employee",
            "article",
          ],
        },
        record_id: { type: "string", minLength: 1, maxLength: 160 },
      },
      required: ["entity_type", "record_id"],
      additionalProperties: false,
    },
  },
  {
    name: "crm_create_workspace_project",
    description:
      "Create a native project in AkiHQ Tasks & Projects. Returns its ID so later tool calls can link tasks to it.",
    permission: "crm:workspace:manage",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2, maxLength: 200 },
        description: { type: "string", maxLength: 4000 },
        status: {
          type: "string",
          enum: ["Planning", "Active", "On hold", "Completed"],
        },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        due_in_days: { type: "integer", minimum: 0, maximum: 1095 },
        owner_id: { type: ["string", "null"], maxLength: 160 },
      },
      required: [
        "name",
        "description",
        "status",
        "priority",
        "due_in_days",
        "owner_id",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "crm_get_single_media_category_link",
    description:
      "Find exactly one media asset in an AkiHQ media category and return its verified private link plus bounded metadata. Fails safely when the category has zero or multiple items. Use the returned verified data before creating a Knowledge article.",
    permission: "crm:workspace:read",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", minLength: 1, maxLength: 120 },
      },
      required: ["category"],
      additionalProperties: false,
    },
  },
  {
    name: "crm_create_workspace_task",
    description:
      "Create a native task in the active AkiHQ CRM workspace. This is a low-risk approved action and immediately appears on the CRM task board.",
    permission: "crm:tasks:create",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 2, maxLength: 200 },
        description: { type: "string", minLength: 1, maxLength: 4000 },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        status: {
          type: "string",
          enum: ["todo", "in-progress", "review", "done"],
        },
        due_in_days: { type: "integer", minimum: 0, maximum: 365 },
        assignee_id: { type: ["string", "null"], maxLength: 160 },
        project_id: { type: ["string", "null"], maxLength: 160 },
      },
      required: [
        "title",
        "description",
        "priority",
        "status",
        "due_in_days",
        "assignee_id",
        "project_id",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "crm_manage_workspace_record",
    description:
      "Create or update a native record across AkiHQ Tasks, Projects, Calendar, Inventory, Billing, Marketing, Sites, Forms, Automation, People, Knowledge, or Inbox. Search first when the destination record or linked data is not known.",
    permission: "crm:workspace:manage",
    approvalRequired: false,
    strict: false,
    parameters: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["create", "update"] },
        entity_type: {
          type: "string",
          enum: [
            "task",
            "project",
            "campaign",
            "conversation",
            "event",
            "product",
            "invoice",
            "page",
            "form",
            "automation",
            "employee",
            "article",
          ],
        },
        record_id: { type: ["string", "null"], maxLength: 160 },
        fields: {
          type: "object",
          description: "Native fields for the selected AkiHQ record type.",
        },
        reason: { type: "string", minLength: 3, maxLength: 1000 },
      },
      required: ["operation", "entity_type", "record_id", "fields", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "crm_post_team_chat_message",
    description:
      "Post an internal message to an existing AkiHQ Team Chat channel.",
    permission: "crm:workspace:manage",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        channel_id: { type: "string", minLength: 1, maxLength: 100 },
        text: { type: "string", minLength: 1, maxLength: 4000 },
      },
      required: ["channel_id", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "ai_request_tool_capability",
    description:
      "Create and delegate a governed Coder task when no current tool can complete the operator request. This requests implementation and tests; it does not activate or deploy the new capability.",
    permission: "ai:tools:request",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        capability: { type: "string", minLength: 3, maxLength: 200 },
        problem: { type: "string", minLength: 10, maxLength: 4000 },
        destination: { type: "string", minLength: 2, maxLength: 500 },
        required_inputs: {
          type: "array",
          items: { type: "string", maxLength: 200 },
          maxItems: 20,
        },
        safety_constraints: {
          type: "array",
          items: { type: "string", maxLength: 300 },
          maxItems: 20,
        },
      },
      required: [
        "capability",
        "problem",
        "destination",
        "required_inputs",
        "safety_constraints",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "ai_request_agent_configuration_change",
    description:
      "Request administrator approval to update another AI agent instructions, role, model, enabled state, or known tool permissions. The change is not applied until approved.",
    permission: "ai:agents:request_change",
    approvalRequired: true,
    strict: false,
    parameters: {
      type: "object",
      properties: {
        target_agent_key: { type: "string", minLength: 2, maxLength: 32 },
        role_description: { type: ["string", "null"], maxLength: 2000 },
        system_instructions: { type: ["string", "null"], maxLength: 24000 },
        model: { type: ["string", "null"], maxLength: 120 },
        enabled: { type: ["boolean", "null"] },
        permissions_to_add: {
          type: "array",
          items: { type: "string", maxLength: 120 },
          maxItems: 40,
        },
        permissions_to_remove: {
          type: "array",
          items: { type: "string", maxLength: 120 },
          maxItems: 40,
        },
        reason: { type: "string", minLength: 3, maxLength: 2000 },
      },
      required: [
        "target_agent_key",
        "role_description",
        "system_instructions",
        "model",
        "enabled",
        "permissions_to_add",
        "permissions_to_remove",
        "reason",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "crm_create_knowledge_article",
    description:
      "Save a durable internal Knowledge article in AkiHQ. Use this for research, procedures, decisions, technical notes, and reusable deliverables requested by the operator.",
    permission: "crm:knowledge:create",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 2, maxLength: 200 },
        category: { type: "string", minLength: 2, maxLength: 80 },
        content: { type: "string", minLength: 1, maxLength: 24000 },
      },
      required: ["title", "category", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "crm_create_calendar_event",
    description:
      "Save a durable internal Calendar entry in AkiHQ. Use this for meetings, deadlines, follow-ups, milestones, bookings, and scheduled operational work requested by the operator.",
    permission: "crm:calendar:create",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 2, maxLength: 200 },
        start: { type: "string", format: "date-time" },
        end: { type: "string", format: "date-time" },
        type: {
          type: "string",
          enum: [
            "Team",
            "Client",
            "Sales",
            "Production",
            "Milestone",
            "Booking",
          ],
        },
        location: { type: "string", maxLength: 300 },
        notes: { type: "string", maxLength: 8000 },
      },
      required: ["title", "start", "end", "type", "location", "notes"],
      additionalProperties: false,
    },
  },
  {
    name: "crm_request_workspace_record_change",
    description:
      "Request administrator approval to create or update a core AkiHQ CRM record. The change is not applied until the approval is executed.",
    permission: "crm:records:request_change",
    approvalRequired: true,
    strict: false,
    parameters: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["create", "update"] },
        entity_type: {
          type: "string",
          enum: ["deal", "lead", "contact", "company"],
        },
        record_id: { type: ["string", "null"], maxLength: 160 },
        fields: {
          type: "object",
          description:
            "Only native fields for the selected record type. Never include IDs, credentials, or undeclared nested objects.",
        },
        reason: { type: "string", minLength: 3, maxLength: 2000 },
      },
      required: ["operation", "entity_type", "record_id", "fields", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "crm_get_business_overview",
    description:
      "Return aggregate CRM counts for users, venues, events, open support reports, active promotion requests, and recent analytics. Returns numbers only and no personal data.",
    permission: "crm:summary:read",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "crm_list_catalogue",
    description:
      "List a bounded set of venues and upcoming events with catalogue status. Returns public operational fields and no customer identity data.",
    permission: "crm:catalogue:read",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 25 },
      },
      required: ["limit"],
      additionalProperties: false,
    },
  },
  {
    name: "crm_list_support_queue",
    description:
      "List a bounded set of open CRM reports for support triage. Reporter identities are excluded.",
    permission: "crm:support:read",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 25 },
      },
      required: ["limit"],
      additionalProperties: false,
    },
  },
  {
    name: "ai_create_task",
    description:
      "Create an internal AI Team task assigned to an enabled agent. Returns the task ID and assignment.",
    permission: "ai:tasks:create",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 2, maxLength: 200 },
        description: { type: "string", minLength: 2, maxLength: 8000 },
        assigned_agent_key: {
          type: ["string", "null"],
          description: "Agent key or null to assign the task to yourself.",
        },
        priority: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["title", "description", "assigned_agent_key", "priority"],
      additionalProperties: false,
    },
  },
  {
    name: "ai_handoff_to_agent",
    description:
      "Pass bounded work context to another enabled agent and optionally associate an existing task. The handoff is visible to the Manager and operator.",
    permission: "ai:handoffs:create",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        to_agent_key: { type: "string", minLength: 2, maxLength: 32 },
        context: { type: "string", minLength: 2, maxLength: 12000 },
        task_id: { type: ["string", "null"], format: "uuid" },
      },
      required: ["to_agent_key", "context", "task_id"],
      additionalProperties: false,
    },
  },
  {
    name: "ai_remember_context",
    description:
      "Store or update one durable memory item for future conversations. Do not store secrets, credentials, or unnecessary personal data.",
    permission: "ai:memory:write",
    approvalRequired: false,
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", minLength: 1, maxLength: 120 },
        content: { type: "string", minLength: 1, maxLength: 8000 },
        importance: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["key", "content", "importance"],
      additionalProperties: false,
    },
  },
  {
    name: "crm_request_venue_status_update",
    description:
      "Request an administrator-approved venue status change. This never changes the venue immediately; it creates a pending approval and returns its ID.",
    permission: "crm:catalogue:request_update",
    approvalRequired: true,
    parameters: {
      type: "object",
      properties: {
        venue_id: { type: "string", format: "uuid" },
        status: {
          type: "string",
          enum: ["draft", "pending", "published", "rejected", "archived"],
        },
        reason: { type: "string", minLength: 3, maxLength: 2000 },
      },
      required: ["venue_id", "status", "reason"],
      additionalProperties: false,
    },
  },
];

const catalogueSchema = z.object({ limit: z.number().int().min(1).max(25) });
const workspaceEntitySchema = z.enum([
  "deal",
  "lead",
  "contact",
  "company",
  "task",
  "project",
  "campaign",
  "conversation",
  "event",
  "product",
  "invoice",
  "page",
  "form",
  "automation",
  "employee",
  "article",
]);
const workspaceSearchSchema = z.object({
  entity_type: workspaceEntitySchema,
  query: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(20),
});
const workspaceRecordSchema = z.object({
  entity_type: workspaceEntitySchema,
  record_id: z.string().trim().min(1).max(160),
});
const workspaceTaskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(4000),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "in-progress", "review", "done"]),
  due_in_days: z.number().int().min(0).max(365),
  assignee_id: z.string().trim().min(1).max(160).nullable(),
  project_id: z.string().trim().min(1).max(160).nullable(),
});
const workspaceProjectSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000),
  status: z.enum(["Planning", "Active", "On hold", "Completed"]),
  priority: z.enum(["low", "medium", "high"]),
  due_in_days: z.number().int().min(0).max(1095),
  owner_id: z.string().trim().min(1).max(160).nullable(),
});
const mediaCategoryLinkInputSchema = z.object({
  category: z.string().trim().min(1).max(120),
});
const mediaCategoryLinkResponseSchema = z.object({
  ok: z.literal(true),
  category: z.string().min(1).max(120),
  match_count: z.literal(1),
  asset: z.object({
    id: z.string().min(1).max(100),
    folder_id: z.string().max(100),
    name: z.string().min(1).max(180),
    content_type: z.string().min(1).max(120),
    size: z.number().nonnegative(),
    created_at: z.string().datetime(),
  }),
  url: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith("https://akihq.app/api/media/file/"),
      "Unexpected media link origin",
    ),
  expires_at: z
    .string()
    .datetime()
    .refine((value) => Date.parse(value) > Date.now(), "Media link is expired"),
});
const knowledgeArticleSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().min(2).max(80),
  content: z.string().trim().min(1).max(24_000),
});
const calendarEventSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    start: z.string().datetime(),
    end: z.string().datetime(),
    type: z.enum([
      "Team",
      "Client",
      "Sales",
      "Production",
      "Milestone",
      "Booking",
    ]),
    location: z.string().trim().max(300),
    notes: z.string().trim().max(8000),
  })
  .refine((input) => new Date(input.end) >= new Date(input.start), {
    message: "Calendar event end must not be before its start",
    path: ["end"],
  });
const workspaceFieldValueSchema = z.union([
  z.string().max(8000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(240)).max(30),
  z.null(),
]);
const managedWorkspaceEntitySchema = z.enum([
  "task",
  "project",
  "campaign",
  "conversation",
  "event",
  "product",
  "invoice",
  "page",
  "form",
  "automation",
  "employee",
  "article",
]);
const managedWorkspaceFields: Record<
  z.infer<typeof managedWorkspaceEntitySchema>,
  Set<string>
> = {
  task: new Set([
    "title",
    "description",
    "projectId",
    "status",
    "priority",
    "assigneeId",
    "dueDate",
    "estimate",
    "tracked",
    "source",
  ]),
  project: new Set([
    "name",
    "description",
    "status",
    "priority",
    "ownerId",
    "dueDate",
    "budget",
    "color",
    "tags",
  ]),
  campaign: new Set([
    "name",
    "description",
    "status",
    "type",
    "channel",
    "budget",
    "startDate",
    "endDate",
    "ownerId",
    "audience",
    "goal",
    "notes",
  ]),
  conversation: new Set([
    "name",
    "email",
    "subject",
    "status",
    "channel",
    "assigneeId",
    "priority",
    "tags",
    "preview",
    "updatedAt",
  ]),
  event: new Set([
    "title",
    "start",
    "end",
    "type",
    "location",
    "notes",
    "color",
    "attendees",
  ]),
  product: new Set([
    "name",
    "sku",
    "category",
    "price",
    "cost",
    "stock",
    "reorderAt",
    "warehouse",
    "status",
    "description",
  ]),
  invoice: new Set([
    "number",
    "title",
    "companyId",
    "contactId",
    "status",
    "currency",
    "subtotal",
    "tax",
    "total",
    "dueDate",
    "notes",
  ]),
  page: new Set([
    "name",
    "title",
    "slug",
    "status",
    "url",
    "description",
    "ownerId",
  ]),
  form: new Set([
    "name",
    "title",
    "status",
    "pageId",
    "description",
    "successMessage",
  ]),
  automation: new Set([
    "name",
    "description",
    "status",
    "trigger",
    "action",
    "enabled",
    "lastRunAt",
  ]),
  employee: new Set([
    "name",
    "email",
    "role",
    "department",
    "status",
    "phone",
    "location",
    "title",
  ]),
  article: new Set(["title", "category", "content", "authorId"]),
};
const teamChatMessageSchema = z.object({
  channel_id: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(4000),
});
const managedWorkspaceRecordSchema = z
  .object({
    operation: z.enum(["create", "update"]),
    entity_type: managedWorkspaceEntitySchema,
    record_id: z.string().trim().min(1).max(160).nullable(),
    fields: z.record(z.string(), workspaceFieldValueSchema),
    reason: z.string().trim().min(3).max(1000),
  })
  .superRefine((input, context) => {
    if (input.operation === "create" && input.record_id)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["record_id"],
        message: "record_id must be null for creates",
      });
    if (input.operation === "update" && !input.record_id)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["record_id"],
        message: "record_id is required for updates",
      });
    if (!Object.keys(input.fields).length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fields"],
        message: "At least one field is required",
      });
    for (const key of Object.keys(input.fields))
      if (!managedWorkspaceFields[input.entity_type].has(key))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields", key],
          message: `Field ${key} is not supported for ${input.entity_type}`,
        });
  });
const toolCapabilitySchema = z.object({
  capability: z.string().trim().min(3).max(200),
  problem: z.string().trim().min(10).max(4000),
  destination: z.string().trim().min(2).max(500),
  required_inputs: z.array(z.string().trim().min(1).max(200)).max(20),
  safety_constraints: z.array(z.string().trim().min(1).max(300)).max(20),
});
const agentConfigurationChangeSchema = z
  .object({
    target_agent_key: z.string().trim().min(2).max(32),
    role_description: z.string().trim().min(1).max(2000).nullable(),
    system_instructions: z.string().trim().min(1).max(24000).nullable(),
    model: z.string().trim().min(1).max(120).nullable(),
    enabled: z.boolean().nullable(),
    permissions_to_add: z.array(z.string().trim().min(1).max(120)).max(40),
    permissions_to_remove: z.array(z.string().trim().min(1).max(120)).max(40),
    reason: z.string().trim().min(3).max(2000),
  })
  .superRefine((input, context) => {
    if (
      !input.role_description &&
      !input.system_instructions &&
      !input.model &&
      input.enabled === null &&
      !input.permissions_to_add.length &&
      !input.permissions_to_remove.length
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one agent change is required",
      });
    const overlap = input.permissions_to_add.filter((permission) =>
      input.permissions_to_remove.includes(permission),
    );
    if (overlap.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["permissions_to_add"],
        message: "A permission cannot be added and removed together",
      });
  });
const workspaceChangeSchema = z
  .object({
    operation: z.enum(["create", "update"]),
    entity_type: z.enum(["deal", "lead", "contact", "company"]),
    record_id: z.string().trim().min(1).max(160).nullable(),
    fields: z.record(z.string(), workspaceFieldValueSchema),
    reason: z.string().trim().min(3).max(2000),
    workspace_id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{2,80}$/)
      .optional(),
  })
  .superRefine((input, context) => {
    if (input.operation === "update" && !input.record_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["record_id"],
        message: "record_id is required for updates",
      });
    }
    if (input.operation === "create" && input.record_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["record_id"],
        message: "record_id must be null for creates",
      });
    }
    if (!Object.keys(input.fields).length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fields"],
        message: "At least one field is required",
      });
    }
  });
const taskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(2).max(8000),
  assigned_agent_key: z.string().trim().min(2).max(32).nullable(),
  priority: z.number().int().min(1).max(5),
});
const handoffSchema = z.object({
  to_agent_key: z.string().trim().min(2).max(32),
  context: z.string().trim().min(2).max(12000),
  task_id: z.string().uuid().nullable(),
});
const memorySchema = z.object({
  key: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(8000),
  importance: z.number().int().min(1).max(5),
});
const venueStatusSchema = z.object({
  venue_id: z.string().uuid(),
  status: z.enum(["draft", "pending", "published", "rejected", "archived"]),
  reason: z.string().trim().min(3).max(2000),
});

export type AIToolContext = {
  service: SupabaseClient;
  agent: AIAgent;
  actorId: string | null;
  taskId?: string | null;
  workspaceId?: string;
};

function assertResult(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function logActivity(
  context: AIToolContext,
  eventType: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await context.service.from("ai_activity_log").insert({
    agent_id: context.agent.id,
    task_id: context.taskId || null,
    event_type: eventType,
    message,
    details,
  });
  assertResult(error);
}

export function availableTools(agent: AIAgent) {
  const permissions = new Set(agent.permissions);
  return toolDefinitions.filter((tool) => permissions.has(tool.permission));
}

type WorkspaceRecord = Record<string, unknown>;
type WorkspaceSnapshot = Record<string, unknown> & {
  pipelines?: WorkspaceRecord[];
  deals?: WorkspaceRecord[];
  leads?: WorkspaceRecord[];
  contacts?: WorkspaceRecord[];
  companies?: WorkspaceRecord[];
  tasks?: WorkspaceRecord[];
  projects?: WorkspaceRecord[];
  invoices?: WorkspaceRecord[];
  campaigns?: WorkspaceRecord[];
  conversations?: WorkspaceRecord[];
  events?: WorkspaceRecord[];
  products?: WorkspaceRecord[];
  pages?: WorkspaceRecord[];
  forms?: WorkspaceRecord[];
  automations?: WorkspaceRecord[];
  employees?: WorkspaceRecord[];
  knowledge?: WorkspaceRecord[];
  teamChat?: {
    channels?: WorkspaceRecord[];
    messages?: Record<string, WorkspaceRecord[]>;
  };
  activities?: WorkspaceRecord[];
  audit?: WorkspaceRecord[];
};

const workspaceCollections = {
  deal: "deals",
  lead: "leads",
  contact: "contacts",
  company: "companies",
  task: "tasks",
  project: "projects",
  campaign: "campaigns",
  conversation: "conversations",
  event: "events",
  product: "products",
  invoice: "invoices",
  page: "pages",
  form: "forms",
  automation: "automations",
  employee: "employees",
  article: "knowledge",
} as const;

const workspaceChangeFields: Record<string, Set<string>> = {
  deal: new Set([
    "title",
    "companyId",
    "contactId",
    "pipelineId",
    "stageId",
    "value",
    "probability",
    "ownerId",
    "dueDate",
    "source",
    "tags",
    "notes",
  ]),
  lead: new Set([
    "name",
    "company",
    "email",
    "phone",
    "status",
    "source",
    "ownerId",
    "score",
  ]),
  contact: new Set([
    "name",
    "companyId",
    "email",
    "phone",
    "role",
    "source",
    "tags",
  ]),
  company: new Set([
    "name",
    "type",
    "city",
    "website",
    "email",
    "phone",
    "ownerId",
    "employees",
    "status",
  ]),
};

const workspaceReadableFields = [
  "id",
  "title",
  "name",
  "status",
  "stageId",
  "pipelineId",
  "value",
  "probability",
  "company",
  "companyId",
  "contactId",
  "source",
  "score",
  "ownerId",
  "assigneeId",
  "projectId",
  "priority",
  "dueDate",
  "email",
  "phone",
  "city",
  "type",
  "role",
  "tags",
  "notes",
  "description",
  "subject",
  "category",
  "sku",
  "total",
  "channel",
  "url",
  "enabled",
  "updatedAt",
  "createdAt",
] as const;

function activeWorkspaceId(context: AIToolContext) {
  return context.workspaceId || "ws_akipasa";
}

async function loadWorkspace(
  context: AIToolContext,
  overrideWorkspaceId?: string,
) {
  const workspaceId = overrideWorkspaceId || activeWorkspaceId(context);
  const { data, error } = await context.service
    .from("workspace_snapshots")
    .select("data,updated_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  assertResult(error);
  if (!data?.data || typeof data.data !== "object") {
    throw new Error(
      "The AkiHQ workspace has not been synchronized yet. Open the CRM once and retry.",
    );
  }
  return {
    workspaceId,
    snapshot: data.data as WorkspaceSnapshot,
    updatedAt: String(data.updated_at),
  };
}

function workspaceRecords(
  snapshot: WorkspaceSnapshot,
  entityType: keyof typeof workspaceCollections,
) {
  const collection = workspaceCollections[entityType];
  const records = snapshot[collection];
  return Array.isArray(records) ? records : [];
}

function workspaceRecordForAI(record: WorkspaceRecord) {
  return Object.fromEntries(
    workspaceReadableFields
      .filter((field) => Object.prototype.hasOwnProperty.call(record, field))
      .map((field) => [field, record[field]]),
  );
}

function appendWorkspaceAudit(
  snapshot: WorkspaceSnapshot,
  context: AIToolContext,
  action: string,
  entityType: string,
  entityId: string,
  detail: string,
) {
  const now = new Date().toISOString();
  const actorId = context.actorId || context.agent.id;
  snapshot.activities = Array.isArray(snapshot.activities)
    ? snapshot.activities
    : [];
  snapshot.audit = Array.isArray(snapshot.audit) ? snapshot.audit : [];
  snapshot.activities.unshift({
    id: "ac_ai_" + crypto.randomUUID(),
    entityType,
    entityId,
    actorId,
    verb: action,
    detail,
    at: now,
    icon: "sparkles",
    agentKey: context.agent.agent_key,
  });
  snapshot.audit.unshift({
    id: "audit_ai_" + crypto.randomUUID(),
    action: "ai." + action.replace(/\s+/g, "_"),
    actorId,
    at: now,
    meta: { entityType, entityId, agentKey: context.agent.agent_key },
  });
  snapshot.activities = snapshot.activities.slice(0, 250);
  snapshot.audit = snapshot.audit.slice(0, 500);
}

async function saveWorkspace(
  context: AIToolContext,
  workspaceId: string,
  snapshot: WorkspaceSnapshot,
  previousUpdatedAt: string,
) {
  const { data, error } = await context.service
    .from("workspace_snapshots")
    .update({
      data: snapshot,
      updated_by: context.actorId,
    })
    .eq("workspace_id", workspaceId)
    .eq("updated_at", previousUpdatedAt)
    .select("updated_at")
    .maybeSingle();
  assertResult(error);
  if (!data) {
    throw new Error(
      "The CRM workspace changed concurrently. Reload the record and retry.",
    );
  }
  return String(data.updated_at);
}

async function runSafeTool(
  name: string,
  rawArguments: unknown,
  context: AIToolContext,
): Promise<unknown> {
  const normalizedArguments = (() => {
    if (!rawArguments || typeof rawArguments !== "object") return rawArguments;
    const record = rawArguments as Record<string, unknown>;
    for (const key of ["arguments", "input", "article", "knowledge_article"]) {
      const candidate = record[key];
      if (
        candidate &&
        typeof candidate === "object" &&
        !Array.isArray(candidate)
      ) {
        return candidate;
      }
    }
    const values = Object.values(record);
    return values.length === 1 && values[0] && typeof values[0] === "object"
      ? values[0]
      : rawArguments;
  })();
  if (name === "crm_workspace_overview") {
    const { workspaceId, snapshot, updatedAt } = await loadWorkspace(context);
    const deals = workspaceRecords(snapshot, "deal");
    const leads = workspaceRecords(snapshot, "lead");
    const tasks = workspaceRecords(snapshot, "task");
    const invoices = Array.isArray(snapshot.invoices) ? snapshot.invoices : [];
    return {
      workspace_id: workspaceId,
      companies: workspaceRecords(snapshot, "company").length,
      contacts: workspaceRecords(snapshot, "contact").length,
      leads: leads.length,
      qualified_leads: leads.filter((item) => item.status === "Qualified")
        .length,
      deals: deals.length,
      open_pipeline_value: deals
        .filter((item) => !["won", "lost"].includes(String(item.stageId || "")))
        .reduce((total, item) => total + Number(item.value || 0), 0),
      projects: workspaceRecords(snapshot, "project").length,
      open_tasks: tasks.filter((item) => item.status !== "done").length,
      overdue_tasks: tasks.filter(
        (item) =>
          item.status !== "done" &&
          typeof item.dueDate === "string" &&
          new Date(item.dueDate).getTime() < Date.now(),
      ).length,
      outstanding_invoices: invoices
        .filter((item) => !["Paid", "Cancelled"].includes(String(item.status)))
        .reduce((total, item) => total + Number(item.total || 0), 0),
      campaigns: Array.isArray(snapshot.campaigns)
        ? snapshot.campaigns.length
        : 0,
      as_of: updatedAt,
    };
  }

  if (name === "crm_search_workspace") {
    const input = workspaceSearchSchema.parse(rawArguments);
    const { workspaceId, snapshot, updatedAt } = await loadWorkspace(context);
    const query = input.query.toLowerCase();
    const matches = workspaceRecords(snapshot, input.entity_type)
      .filter((record) =>
        workspaceReadableFields.some((field) =>
          String(record[field] ?? "")
            .toLowerCase()
            .includes(query),
        ),
      )
      .slice(0, input.limit)
      .map(workspaceRecordForAI);
    return {
      workspace_id: workspaceId,
      entity_type: input.entity_type,
      matches,
      as_of: updatedAt,
    };
  }

  if (name === "crm_get_workspace_record") {
    const input = workspaceRecordSchema.parse(rawArguments);
    const { workspaceId, snapshot, updatedAt } = await loadWorkspace(context);
    const record = workspaceRecords(snapshot, input.entity_type).find(
      (item) => String(item.id) === input.record_id,
    );
    if (!record) throw new Error("CRM record not found");
    return {
      workspace_id: workspaceId,
      entity_type: input.entity_type,
      record: workspaceRecordForAI(record),
      as_of: updatedAt,
    };
  }

  if (name === "crm_create_workspace_project") {
    const input = workspaceProjectSchema.parse(rawArguments);
    const { workspaceId, snapshot, updatedAt } = await loadWorkspace(context);
    const employees = Array.isArray(snapshot.employees)
      ? (snapshot.employees as WorkspaceRecord[])
      : [];
    if (
      input.owner_id &&
      !employees.some((item) => String(item.id) === input.owner_id)
    )
      throw new Error("CRM project owner is unavailable");
    const now = new Date();
    const project = {
      id: "pr_ai_" + crypto.randomUUID(),
      name: input.name,
      description: input.description,
      status: input.status,
      priority: input.priority,
      ownerId: input.owner_id || context.actorId || "",
      dueDate: new Date(
        now.getTime() + input.due_in_days * 86_400_000,
      ).toISOString(),
      progress: input.status === "Completed" ? 100 : 0,
      source: "AI Team",
      createdByAgentKey: context.agent.agent_key,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    snapshot.projects = Array.isArray(snapshot.projects)
      ? snapshot.projects
      : [];
    snapshot.projects.unshift(project);
    appendWorkspaceAudit(
      snapshot,
      context,
      "created CRM project",
      "project",
      project.id,
      project.name,
    );
    const savedAt = await saveWorkspace(
      context,
      workspaceId,
      snapshot,
      updatedAt,
    );
    await logActivity(
      context,
      "crm.project.created",
      "Created CRM project: " + input.name,
      { workspace_id: workspaceId, crm_project_id: project.id },
    );
    return {
      workspace_id: workspaceId,
      project_id: project.id,
      status: project.status,
      synchronized_at: savedAt,
    };
  }

  if (name === "crm_get_single_media_category_link") {
    const input = mediaCategoryLinkInputSchema.parse(rawArguments);
    const secret = process.env.AI_CRM_PROXY_SECRET || "";
    if (!secret)
      throw new Error("The internal AkiHQ media bridge is not configured");
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    if (!env.AKIHQ_GATEWAY || typeof env.AKIHQ_GATEWAY.fetch !== "function")
      throw new Error(
        "The internal AkiHQ media service binding is unavailable",
      );
    const response = await env.AKIHQ_GATEWAY.fetch(
      new Request(
        "https://akihq.internal/api/internal/ai/media/single-category-link",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-akipasa-ai-crm": secret,
          },
          body: JSON.stringify({
            category: input.category,
            workspaceId: activeWorkspaceId(context),
          }),
        },
      ),
    );
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 600);
      throw new Error(
        `AkiHQ media lookup failed (${response.status}): ${detail}`,
      );
    }
    return mediaCategoryLinkResponseSchema.parse(await response.json());
  }

  if (name === "crm_create_workspace_task") {
    const input = workspaceTaskSchema.parse(rawArguments);
    const { workspaceId, snapshot, updatedAt } = await loadWorkspace(context);
    const employees = Array.isArray(snapshot.employees)
      ? (snapshot.employees as WorkspaceRecord[])
      : [];
    const projects = workspaceRecords(snapshot, "project");
    if (
      input.assignee_id &&
      !employees.some((item) => String(item.id) === input.assignee_id)
    ) {
      throw new Error("CRM task assignee is unavailable");
    }
    if (
      input.project_id &&
      !projects.some((item) => String(item.id) === input.project_id)
    ) {
      throw new Error("CRM task project is unavailable");
    }
    const now = new Date();
    const task = {
      id: "tk_ai_" + crypto.randomUUID(),
      title: input.title,
      description: input.description,
      projectId: input.project_id || "",
      status: input.status,
      priority: input.priority,
      assigneeId: input.assignee_id || context.actorId || "",
      dueDate: new Date(
        now.getTime() + input.due_in_days * 86_400_000,
      ).toISOString(),
      estimate: 60,
      tracked: 0,
      source: "AI Team",
      createdByAgentKey: context.agent.agent_key,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    snapshot.tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
    snapshot.tasks.unshift(task);
    appendWorkspaceAudit(
      snapshot,
      context,
      "created CRM task",
      "task",
      task.id,
      task.title,
    );
    const savedAt = await saveWorkspace(
      context,
      workspaceId,
      snapshot,
      updatedAt,
    );
    await logActivity(
      context,
      "crm.task.created",
      "Created CRM task: " + input.title,
      { workspace_id: workspaceId, crm_task_id: task.id },
    );
    return {
      workspace_id: workspaceId,
      task_id: task.id,
      status: task.status,
      synchronized_at: savedAt,
    };
  }

  if (name === "crm_manage_workspace_record") {
    const input = managedWorkspaceRecordSchema.parse(normalizedArguments);
    const { workspaceId, snapshot, updatedAt } = await loadWorkspace(context);
    const collection = workspaceCollections[input.entity_type];
    const records = Array.isArray(snapshot[collection])
      ? (snapshot[collection] as WorkspaceRecord[])
      : [];
    const now = new Date().toISOString();
    let record: WorkspaceRecord;
    if (input.operation === "create") {
      record = {
        id: `${input.entity_type.slice(0, 2)}_ai_${crypto.randomUUID()}`,
        ...input.fields,
        source: input.fields.source || "AI Team",
        createdAt: now,
        updatedAt: now,
      };
      records.unshift(record);
    } else {
      const index = records.findIndex(
        (item) => String(item.id) === input.record_id,
      );
      if (index < 0) throw new Error(`CRM ${input.entity_type} not found`);
      records[index] = record = {
        ...records[index],
        ...input.fields,
        updatedAt: now,
      };
    }
    snapshot[collection] = records;
    appendWorkspaceAudit(
      snapshot,
      context,
      `${input.operation}d CRM ${input.entity_type}`,
      input.entity_type,
      String(record.id),
      String(record.title || record.name || record.subject || record.id),
    );
    const savedAt = await saveWorkspace(
      context,
      workspaceId,
      snapshot,
      updatedAt,
    );
    await logActivity(
      context,
      `crm.${input.entity_type}.${input.operation}d`,
      `${input.operation}d CRM ${input.entity_type}: ${String(record.title || record.name || record.subject || record.id)}`,
      { workspace_id: workspaceId, record_id: record.id, reason: input.reason },
    );
    return {
      workspace_id: workspaceId,
      entity_type: input.entity_type,
      record_id: record.id,
      operation: input.operation,
      synchronized_at: savedAt,
    };
  }

  if (name === "crm_post_team_chat_message") {
    const input = teamChatMessageSchema.parse(rawArguments);
    const { workspaceId, snapshot, updatedAt } = await loadWorkspace(context);
    const channels = Array.isArray(snapshot.teamChat?.channels)
      ? snapshot.teamChat.channels
      : [];
    if (!channels.some((channel) => String(channel.id) === input.channel_id))
      throw new Error("AkiHQ Team Chat channel not found");
    snapshot.teamChat = snapshot.teamChat || {};
    snapshot.teamChat.messages = snapshot.teamChat.messages || {};
    const messages = Array.isArray(snapshot.teamChat.messages[input.channel_id])
      ? snapshot.teamChat.messages[input.channel_id]
      : [];
    const message = {
      id: "msg_ai_" + crypto.randomUUID(),
      authorId: context.actorId || context.agent.id,
      authorName: context.agent.display_name,
      role: "AI Agent",
      text: input.text,
      at: new Date().toISOString(),
      reactions: {},
    };
    messages.push(message);
    snapshot.teamChat.messages[input.channel_id] = messages.slice(-500);
    appendWorkspaceAudit(
      snapshot,
      context,
      "posted Team Chat message",
      "team_chat",
      message.id,
      input.text.slice(0, 160),
    );
    const savedAt = await saveWorkspace(
      context,
      workspaceId,
      snapshot,
      updatedAt,
    );
    await logActivity(
      context,
      "crm.team_chat.posted",
      "Posted an internal Team Chat message",
      {
        workspace_id: workspaceId,
        channel_id: input.channel_id,
        message_id: message.id,
      },
    );
    return {
      workspace_id: workspaceId,
      channel_id: input.channel_id,
      message_id: message.id,
      synchronized_at: savedAt,
    };
  }

  if (name === "crm_create_knowledge_article") {
    const input = knowledgeArticleSchema.parse(normalizedArguments);
    const workspaceId = activeWorkspaceId(context);
    const now = new Date().toISOString();
    const recordId = "kb_ai_" + crypto.randomUUID();
    const article = {
      id: recordId,
      title: input.title,
      category: input.category,
      authorId: context.actorId || "",
      content: input.content,
      source: "AI Team",
      createdByAgentKey: context.agent.agent_key,
      createdAt: now,
      updatedAt: now,
    };
    const { error } = await context.service
      .from("crm_workspace_records")
      .upsert(
        {
          workspace_id: workspaceId,
          record_type: "article",
          record_id: recordId,
          data: article,
          updated_by: context.actorId,
        },
        { onConflict: "workspace_id,record_type,record_id" },
      );
    assertResult(error);
    await logActivity(
      context,
      "crm.knowledge.created",
      "Created Knowledge article: " + input.title,
      { workspace_id: workspaceId, article_id: recordId },
    );
    return { workspace_id: workspaceId, article_id: recordId, saved: true };
  }

  if (name === "crm_create_calendar_event") {
    const input = calendarEventSchema.parse(rawArguments);
    const workspaceId = activeWorkspaceId(context);
    const now = new Date().toISOString();
    const recordId = "ev_ai_" + crypto.randomUUID();
    const event = {
      id: recordId,
      title: input.title,
      start: input.start,
      end: input.end,
      type: input.type,
      color: "#7c8cff",
      location: input.location,
      notes: input.notes,
      attendees: [],
      source: "AI Team",
      createdByAgentKey: context.agent.agent_key,
      createdAt: now,
      updatedAt: now,
    };
    const { error } = await context.service
      .from("crm_workspace_records")
      .upsert(
        {
          workspace_id: workspaceId,
          record_type: "event",
          record_id: recordId,
          data: event,
          updated_by: context.actorId,
        },
        { onConflict: "workspace_id,record_type,record_id" },
      );
    assertResult(error);
    await logActivity(
      context,
      "crm.calendar.created",
      "Created Calendar entry: " + input.title,
      { workspace_id: workspaceId, calendar_event_id: recordId },
    );
    return {
      workspace_id: workspaceId,
      calendar_event_id: recordId,
      saved: true,
    };
  }

  if (name === "crm_get_business_overview") {
    const [users, venues, events, reports, promotions, analytics] =
      await Promise.all([
        context.service
          .from("profiles")
          .select("*", { count: "exact", head: true }),
        context.service
          .from("venues")
          .select("*", { count: "exact", head: true }),
        context.service
          .from("events")
          .select("*", { count: "exact", head: true }),
        context.service
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("state", "open"),
        context.service
          .from("promotion_requests")
          .select("*", { count: "exact", head: true })
          .in("state", ["new", "contacted", "qualified"]),
        context.service
          .from("analytics_events")
          .select("*", { count: "exact", head: true })
          .gte(
            "occurred_at",
            new Date(Date.now() - 30 * 86_400_000).toISOString(),
          ),
      ]);
    for (const result of [
      users,
      venues,
      events,
      reports,
      promotions,
      analytics,
    ]) {
      assertResult(result.error);
    }
    return {
      users: users.count || 0,
      venues: venues.count || 0,
      events: events.count || 0,
      open_support_reports: reports.count || 0,
      active_promotion_requests: promotions.count || 0,
      analytics_events_last_30_days: analytics.count || 0,
      as_of: new Date().toISOString(),
    };
  }

  if (name === "crm_list_catalogue") {
    const { limit } = catalogueSchema.parse(rawArguments);
    const [venues, events] = await Promise.all([
      context.service
        .from("venues")
        .select("id,slug,name,address,verified,status,created_at")
        .order("updated_at", { ascending: false })
        .limit(limit),
      context.service
        .from("events")
        .select("id,slug,title_es,title_en,status,venue_id,created_at")
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);
    assertResult(venues.error);
    assertResult(events.error);
    return { venues: venues.data || [], events: events.data || [] };
  }

  if (name === "crm_list_support_queue") {
    const { limit } = catalogueSchema.parse(rawArguments);
    const { data, error } = await context.service
      .from("reports")
      .select("id,target_type,target_id,reason,details,state,created_at")
      .eq("state", "open")
      .order("created_at", { ascending: true })
      .limit(limit);
    assertResult(error);
    return { reports: data || [] };
  }

  if (name === "ai_create_task") {
    const input = taskSchema.parse(rawArguments);
    let assignedAgentId = context.agent.id;
    let assignedAgentKey = context.agent.agent_key;
    if (input.assigned_agent_key) {
      const { data: assigned, error } = await context.service
        .from("ai_agents")
        .select("id,agent_key")
        .eq("agent_key", input.assigned_agent_key)
        .eq("enabled", true)
        .maybeSingle();
      assertResult(error);
      if (!assigned) throw new Error("Assigned agent is unavailable");
      assignedAgentId = assigned.id;
      assignedAgentKey = assigned.agent_key;
    }
    const { data, error } = await context.service
      .from("ai_tasks")
      .insert({
        title: input.title,
        description: input.description,
        priority: input.priority,
        created_by_agent_id: context.agent.id,
        assigned_agent_id: assignedAgentId,
        created_by_profile_id: context.actorId,
        parent_task_id: context.taskId || null,
      })
      .select("id,status")
      .single();
    assertResult(error);
    await logActivity(context, "task.created", `Created task: ${input.title}`, {
      assigned_agent_key: assignedAgentKey,
      priority: input.priority,
    });
    return {
      task_id: data?.id,
      status: data?.status,
      assigned_agent_key: assignedAgentKey,
    };
  }

  if (name === "ai_request_tool_capability") {
    const input = toolCapabilitySchema.parse(rawArguments);
    const { data: coder, error: coderError } = await context.service
      .from("ai_agents")
      .select("id,agent_key")
      .eq("agent_key", "coder")
      .eq("enabled", true)
      .maybeSingle();
    assertResult(coderError);
    if (!coder) throw new Error("Coder agent is unavailable");
    const description = [
      `Capability gap: ${input.problem}`,
      `Intended destination: ${input.destination}`,
      `Required inputs: ${input.required_inputs.join(", ") || "None identified"}`,
      `Safety constraints: ${input.safety_constraints.join("; ") || "Preserve existing authorization and approval boundaries."}`,
      "Inspect the live code path, implement the smallest auditable tool, add tests, and leave activation/deployment pending administrator approval.",
    ].join("\n");
    const { data, error } = await context.service
      .from("ai_tasks")
      .insert({
        title: `Tool capability: ${input.capability}`,
        description,
        priority: 4,
        created_by_agent_id: context.agent.id,
        assigned_agent_id: coder.id,
        created_by_profile_id: context.actorId,
        parent_task_id: context.taskId || null,
      })
      .select("id,status")
      .single();
    assertResult(error);
    await logActivity(
      context,
      "tool.capability.requested",
      `Requested tool capability: ${input.capability}`,
      { task_id: data?.id, destination: input.destination },
    );
    return {
      task_id: data?.id,
      status: data?.status,
      assigned_agent_key: coder.agent_key,
      activation: "administrator_approval_required",
    };
  }

  if (name === "ai_handoff_to_agent") {
    const input = handoffSchema.parse(rawArguments);
    const { data: target, error: targetError } = await context.service
      .from("ai_agents")
      .select("id,agent_key")
      .eq("agent_key", input.to_agent_key)
      .eq("enabled", true)
      .maybeSingle();
    assertResult(targetError);
    if (!target || target.id === context.agent.id)
      throw new Error("Invalid handoff target");
    const { data, error } = await context.service
      .from("ai_handoffs")
      .insert({
        from_agent_id: context.agent.id,
        to_agent_id: target.id,
        task_id: input.task_id,
        context: input.context,
      })
      .select("id")
      .single();
    assertResult(error);
    await logActivity(
      context,
      "handoff.created",
      `Passed context to ${target.agent_key}`,
      {
        to_agent_key: target.agent_key,
        handoff_id: data?.id,
      },
    );
    return { handoff_id: data?.id, to_agent_key: target.agent_key };
  }

  if (name === "ai_remember_context") {
    const input = memorySchema.parse(rawArguments);
    const { data, error } = await context.service
      .from("ai_agent_memory")
      .upsert(
        {
          agent_id: context.agent.id,
          memory_key: input.key,
          content: input.content,
          importance: input.importance,
          source: "agent",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agent_id,memory_key" },
      )
      .select("id,memory_key")
      .single();
    assertResult(error);
    return { memory_id: data?.id, key: data?.memory_key };
  }

  throw new Error(`Unknown AI tool: ${name}`);
}

export async function executeToolCall(
  call: AIToolCall,
  context: AIToolContext,
) {
  const definition = availableTools(context.agent).find(
    (tool) => tool.name === call.name,
  );
  if (!definition)
    throw new Error("The agent is not permitted to use this tool");

  if (definition.approvalRequired) {
    const input =
      call.name === "crm_request_workspace_record_change"
        ? {
            ...workspaceChangeSchema.parse(call.arguments),
            workspace_id: activeWorkspaceId(context),
          }
        : call.name === "ai_request_agent_configuration_change"
          ? agentConfigurationChangeSchema.parse(call.arguments)
          : venueStatusSchema.parse(call.arguments);
    const { data, error } = await context.service
      .from("ai_approvals")
      .insert({
        requested_by_agent_id: context.agent.id,
        task_id: context.taskId || null,
        tool_name: call.name,
        arguments: input,
        reason: input.reason,
      })
      .select("id,status")
      .single();
    assertResult(error);
    await context.service
      .from("ai_agents")
      .update({ status: "waiting", last_active_at: new Date().toISOString() })
      .eq("id", context.agent.id);
    await logActivity(
      context,
      "approval.requested",
      "Requested approval for " + call.name,
      {
        approval_id: data?.id,
        tool_name: call.name,
      },
    );
    return {
      approval_required: true,
      approval_id: data?.id,
      status: data?.status,
      message:
        "The action is waiting for administrator approval and has not been executed.",
    };
  }

  return runSafeTool(call.name, call.arguments, context);
}

async function executeWorkspaceChange(
  rawArguments: unknown,
  context: AIToolContext,
) {
  if (!context.actorId) throw new Error("Approval actor is required");
  const input = workspaceChangeSchema.parse(rawArguments);
  const { workspaceId, snapshot, updatedAt } = await loadWorkspace(
    context,
    input.workspace_id,
  );
  const allowedFields = workspaceChangeFields[input.entity_type];
  const invalidFields = Object.keys(input.fields).filter(
    (field) => !allowedFields.has(field),
  );
  if (invalidFields.length) {
    throw new Error(
      "These CRM fields cannot be changed by AI: " + invalidFields.join(", "),
    );
  }

  const collectionName = workspaceCollections[input.entity_type];
  const collection = Array.isArray(snapshot[collectionName])
    ? [...(snapshot[collectionName] as WorkspaceRecord[])]
    : [];
  const approvedFields = Object.fromEntries(Object.entries(input.fields));
  const now = new Date().toISOString();
  let record: WorkspaceRecord;

  if (input.operation === "update") {
    const recordIndex = collection.findIndex(
      (item) => String(item.id) === input.record_id,
    );
    if (recordIndex < 0) {
      throw new Error("The requested CRM record no longer exists");
    }
    record = {
      ...collection[recordIndex],
      ...approvedFields,
      id: collection[recordIndex].id,
      createdAt: collection[recordIndex].createdAt,
      updatedAt: now,
    };
    collection[recordIndex] = record;
  } else {
    const requiredLabel =
      input.entity_type === "deal" ? approvedFields.title : approvedFields.name;
    if (typeof requiredLabel !== "string" || !requiredLabel.trim()) {
      throw new Error(
        input.entity_type === "deal"
          ? "A deal title is required"
          : "A record name is required",
      );
    }

    const idPrefixes: Record<string, string> = {
      deal: "dl_ai_",
      lead: "ld_ai_",
      contact: "ct_ai_",
      company: "co_ai_",
    };
    const defaults: Record<string, WorkspaceRecord> = {
      lead: { status: "New", source: "AI Team", score: 50 },
      contact: { source: "AI Team", tags: [] },
      company: { type: "Prospect", status: "Prospect", employees: 1 },
      deal: {
        value: 0,
        probability: 20,
        source: "AI Team",
        tags: [],
      },
    };
    record = {
      ...defaults[input.entity_type],
      ...approvedFields,
      id: idPrefixes[input.entity_type] + crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    if (input.entity_type === "deal") {
      const firstPipeline = Array.isArray(snapshot.pipelines)
        ? snapshot.pipelines[0]
        : undefined;
      const stages = Array.isArray(firstPipeline?.stages)
        ? (firstPipeline.stages as WorkspaceRecord[])
        : [];
      record.pipelineId = record.pipelineId || firstPipeline?.id;
      record.stageId = record.stageId || stages[0]?.id;
      if (!record.pipelineId || !record.stageId) {
        throw new Error(
          "A CRM pipeline and stage are required before AI can create a deal",
        );
      }
    }
    collection.unshift(record);
  }

  snapshot[collectionName] = collection;
  const recordId = String(record.id);
  const label = String(record.title || record.name || recordId);
  appendWorkspaceAudit(
    snapshot,
    context,
    input.operation + "d",
    input.entity_type,
    recordId,
    "AI " + input.operation + "d " + input.entity_type + ": " + label,
  );
  await saveWorkspace(context, workspaceId, snapshot, updatedAt);
  await logActivity(
    context,
    "crm.record." + input.operation + "d",
    "CRM " + input.entity_type + " " + input.operation + "d after approval",
    {
      workspace_id: workspaceId,
      entity_type: input.entity_type,
      record_id: recordId,
    },
  );
  return {
    workspace_id: workspaceId,
    operation: input.operation,
    entity_type: input.entity_type,
    record: workspaceRecordForAI(record),
  };
}

export async function executeApprovedTool(
  toolName: string,
  rawArguments: unknown,
  context: AIToolContext,
) {
  if (toolName === "crm_request_workspace_record_change") {
    return executeWorkspaceChange(rawArguments, context);
  }
  if (toolName === "ai_request_agent_configuration_change") {
    if (!context.actorId) throw new Error("Approval actor is required");
    const input = agentConfigurationChangeSchema.parse(rawArguments);
    const { data: target, error: targetError } = await context.service
      .from("ai_agents")
      .select("id,agent_key,permissions")
      .eq("agent_key", input.target_agent_key)
      .maybeSingle();
    assertResult(targetError);
    if (!target) throw new Error("Target AI agent is unavailable");
    const knownPermissions = new Set(
      toolDefinitions.map((tool) => tool.permission),
    );
    const requestedPermissions = [
      ...input.permissions_to_add,
      ...input.permissions_to_remove,
    ];
    const unknown = requestedPermissions.filter(
      (permission) => !knownPermissions.has(permission),
    );
    if (unknown.length)
      throw new Error("Unknown AI tool permissions: " + unknown.join(", "));
    const permissions = new Set(
      Array.isArray(target.permissions)
        ? target.permissions.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    );
    input.permissions_to_add.forEach((permission) =>
      permissions.add(permission),
    );
    input.permissions_to_remove.forEach((permission) =>
      permissions.delete(permission),
    );
    const update: Record<string, unknown> = {
      permissions: [...permissions],
      updated_at: new Date().toISOString(),
    };
    if (input.role_description !== null)
      update.role_description = input.role_description;
    if (input.system_instructions !== null)
      update.system_instructions = input.system_instructions;
    if (input.model !== null) update.model = input.model;
    if (input.enabled !== null) update.enabled = input.enabled;
    const { data, error } = await context.service
      .from("ai_agents")
      .update(update)
      .eq("id", target.id)
      .select(
        "agent_key,display_name,role_description,permissions,model,enabled,updated_at",
      )
      .single();
    assertResult(error);
    await logActivity(
      context,
      "ai.agent.configuration_updated",
      `Updated AI agent configuration: ${target.agent_key}`,
      { target_agent_key: target.agent_key, reason: input.reason },
    );
    return { updated: true, agent: data };
  }
  if (toolName !== "crm_request_venue_status_update") {
    throw new Error("This approval tool is not executable");
  }
  const input = venueStatusSchema.parse(rawArguments);
  const { data: venue, error: venueError } = await context.service
    .from("venues")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.venue_id)
    .select("id,name,status")
    .single();
  assertResult(venueError);
  if (!venue) throw new Error("Venue not found");

  if (!context.actorId) throw new Error("Approval actor is required");
  const { error: auditError } = await context.service
    .from("moderation_actions")
    .insert({
      actor_id: context.actorId,
      action: "ai_approved_venue_status_changed",
      target_type: "venue",
      target_id: input.venue_id,
      reason: input.reason,
      metadata: {
        agent_key: context.agent.agent_key,
        requested_tool: toolName,
        resulting_status: input.status,
      },
    });
  assertResult(auditError);
  await logActivity(
    context,
    "approval.executed",
    `Updated venue status to ${input.status}`,
    {
      venue_id: input.venue_id,
      status: input.status,
    },
  );
  return { venue_id: venue.id, venue_name: venue.name, status: venue.status };
}
