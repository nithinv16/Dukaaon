/**
 * Bedrock proxy — Claude via InvokeModel.
 *
 * The client previously constructed a `BedrockRuntimeClient` directly with
 * `EXPO_PUBLIC_AWS_ACCESS_KEY_ID` / `EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY`. Those are
 * long-lived IAM credentials inlined into the JS bundle — recoverable from any
 * shipped APK and usable against the whole account, not just Bedrock. They now
 * exist only in this function's environment.
 *
 * Request:
 *   {
 *     system?: string,
 *     messages: Array<{ role: 'user'|'assistant', content: string | ContentBlock[] }>,
 *     tools?: Array<{ name, description?, input_schema }>,
 *     maxTokens?: number,
 *     temperature?: number,
 *     model?: string        // must be allow-listed below
 *   }
 * Response: { content: ClaudeBlock[], text: string, stopReason: string, usage: {...} }
 *
 * The Claude request body is assembled here rather than accepted from the client,
 * so a caller cannot smuggle arbitrary Bedrock parameters or target a model the
 * account pays a premium for.
 *
 * `content` is returned as the raw Claude block array, not just flattened text,
 * because the ordering agent depends on `tool_use` blocks to drive function
 * calling. Returning text alone would silently disable that entire feature.
 *
 * `tools` is accepted from the client by design: a tool schema describes
 * functions the *client* will execute itself, so it grants no server-side
 * capability. The boundary that matters — AWS credentials, model choice, token
 * ceilings — stays here. Schemas are still shape-checked and size-capped.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticate,
  consumeRateLimit,
  errorResponse,
  handlePreflight,
  jsonResponse,
  parseJsonBody,
} from "../_shared/guard.ts";
import { AwsError, awsConfigError, bedrockInvoke } from "../_shared/aws.ts";

const FUNCTION_NAME = "ai-chat";

/**
 * Allow-listed models. An arbitrary client-supplied `model` would let a caller
 * pick the most expensive model available to the account.
 */
const DEFAULT_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const ALLOWED_MODELS = new Set([
  DEFAULT_MODEL,
  "us.anthropic.claude-3-5-haiku-20241022-v1:0",
]);

const ANTHROPIC_VERSION = "bedrock-2023-05-31";

const MAX_BODY_BYTES = 6 * 1024 * 1024; // vision messages carry base64 images
const MAX_MESSAGES = 40;
const MAX_SYSTEM_CHARS = 40_000;
const MAX_TEXT_CHARS = 20_000;
const MAX_OUTPUT_TOKENS = 8_192;
const MAX_TOOLS = 32;
const MAX_TOOL_SCHEMA_CHARS = 20_000;

interface ChatBody {
  system?: unknown;
  messages?: unknown;
  tools?: unknown;
  maxTokens?: unknown;
  temperature?: unknown;
  model?: unknown;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean };

interface ClaudeTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (awsConfigError) {
    console.error(awsConfigError);
    return errorResponse("AI service is not configured", 503, "AWS_UNCONFIGURED");
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  const parsed = await parseJsonBody<ChatBody>(req, MAX_BODY_BYTES);
  if (parsed instanceof Response) return parsed;

  const model = typeof parsed.model === "string" ? parsed.model : DEFAULT_MODEL;
  if (!ALLOWED_MODELS.has(model)) {
    return errorResponse(`Model "${model}" is not permitted`, 400, "MODEL_NOT_ALLOWED");
  }

  const system = typeof parsed.system === "string" ? parsed.system : undefined;
  if (system && system.length > MAX_SYSTEM_CHARS) {
    return errorResponse(`system prompt exceeds ${MAX_SYSTEM_CHARS} characters`, 400);
  }

  const messages = normaliseMessages(parsed.messages);
  if (messages instanceof Response) return messages;

  const tools = normaliseTools(parsed.tools);
  if (tools instanceof Response) return tools;

  const maxTokens = clampInt(parsed.maxTokens, 1, MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);
  const temperature = clampFloat(parsed.temperature, 0, 1, 0.1);

  // Cost scales with output tokens far more than request count, so charge quota
  // proportionally rather than one unit per call.
  const cost = Math.max(1, Math.ceil(maxTokens / 1_000));
  const limited = await consumeRateLimit(auth, FUNCTION_NAME, cost);
  if (limited) return limited;

  try {
    const result = await bedrockInvoke<{
      content?: Array<{ type?: string; text?: string }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>(model, {
      anthropic_version: ANTHROPIC_VERSION,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages,
      ...(tools.length > 0 ? { tools } : {}),
    });

    const content = result.content ?? [];
    const text = content
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("");

    return jsonResponse({
      // Raw Claude blocks: the agent needs tool_use entries, not just text.
      content,
      text,
      stopReason: result.stop_reason ?? "end_turn",
      usage: {
        inputTokens: result.usage?.input_tokens ?? 0,
        outputTokens: result.usage?.output_tokens ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof AwsError) {
      console.error(`${FUNCTION_NAME} bedrock error ${error.status}: ${error.detail}`);
      if (error.status === 429) {
        return errorResponse("AI provider is busy, please retry", 429, "PROVIDER_THROTTLED");
      }
      if (error.status === 400) {
        return errorResponse("AI request was rejected", 400, "PROVIDER_REJECTED");
      }
      return errorResponse("AI provider error", 502, "PROVIDER_ERROR");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse("AI provider timed out", 504, "PROVIDER_TIMEOUT");
    }
    console.error(`${FUNCTION_NAME} unexpected error:`, error);
    return errorResponse("Internal server error", 500);
  }
});

/**
 * Validate the tool schema array.
 *
 * These describe functions the client executes locally, so they confer no
 * server-side capability — but they are still forwarded to a paid API, so the
 * count and serialised size are bounded, and each entry is rebuilt to drop
 * unrecognised fields.
 */
function normaliseTools(raw: unknown): ClaudeTool[] | Response {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    return errorResponse("`tools` must be an array", 400);
  }
  if (raw.length > MAX_TOOLS) {
    return errorResponse(`At most ${MAX_TOOLS} tools per request`, 400);
  }

  const tools: ClaudeTool[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      return errorResponse("Each tool must be an object", 400);
    }
    const t = entry as Record<string, unknown>;

    const name = typeof t.name === "string" ? t.name : "";
    // Anthropic requires tool names to match ^[a-zA-Z0-9_-]{1,64}$.
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
      return errorResponse(`Invalid tool name "${name}"`, 400);
    }
    if (seen.has(name)) {
      return errorResponse(`Duplicate tool name "${name}"`, 400);
    }
    seen.add(name);

    const schema = t.input_schema;
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      return errorResponse(`Tool "${name}" requires an input_schema object`, 400);
    }
    if (JSON.stringify(schema).length > MAX_TOOL_SCHEMA_CHARS) {
      return errorResponse(`Tool "${name}" input_schema is too large`, 400);
    }

    tools.push({
      name,
      ...(typeof t.description === "string" ? { description: t.description } : {}),
      input_schema: schema as Record<string, unknown>,
    });
  }

  return tools;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? Math.floor(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Validate and normalise the message array.
 *
 * Rebuilt rather than passed through so that only known block shapes reach
 * Bedrock, and `system` cannot be injected as a pseudo-role.
 */
function normaliseMessages(
  raw: unknown
): Array<{ role: "user" | "assistant"; content: ContentBlock[] }> | Response {
  if (!Array.isArray(raw) || raw.length === 0) {
    return errorResponse("`messages` must be a non-empty array", 400);
  }
  if (raw.length > MAX_MESSAGES) {
    return errorResponse(`At most ${MAX_MESSAGES} messages per request`, 400);
  }

  const out: Array<{ role: "user" | "assistant"; content: ContentBlock[] }> = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      return errorResponse("Each message must be an object", 400);
    }
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") {
      return errorResponse('Message role must be "user" or "assistant"', 400);
    }

    if (typeof content === "string") {
      if (content.length > MAX_TEXT_CHARS) {
        return errorResponse(`Message text exceeds ${MAX_TEXT_CHARS} characters`, 400);
      }
      out.push({ role, content: [{ type: "text", text: content }] });
      continue;
    }

    if (!Array.isArray(content)) {
      return errorResponse("Message content must be a string or an array of blocks", 400);
    }

    const blocks: ContentBlock[] = [];
    for (const block of content) {
      if (!block || typeof block !== "object") {
        return errorResponse("Each content block must be an object", 400);
      }
      const b = block as Record<string, unknown>;

      if (b.type === "text") {
        const text = typeof b.text === "string" ? b.text : "";
        if (text.length > MAX_TEXT_CHARS) {
          return errorResponse(`Message text exceeds ${MAX_TEXT_CHARS} characters`, 400);
        }
        blocks.push({ type: "text", text });
        continue;
      }

      if (b.type === "image") {
        const source = b.source as Record<string, unknown> | undefined;
        const mediaType = typeof source?.media_type === "string" ? source.media_type : "";
        const data = typeof source?.data === "string" ? source.data : "";
        if (!ALLOWED_IMAGE_TYPES.has(mediaType)) {
          return errorResponse(`Unsupported image media_type "${mediaType}"`, 400);
        }
        if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
          return errorResponse("Image data must be base64-encoded", 400);
        }
        blocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data } });
        continue;
      }

      // tool_use / tool_result must be accepted so a multi-turn function-calling
      // exchange can be replayed back to the model. Without these the agent could
      // make one tool call and never report the result.
      if (b.type === "tool_use") {
        const id = typeof b.id === "string" ? b.id : "";
        const name = typeof b.name === "string" ? b.name : "";
        if (!id || !name) {
          return errorResponse("tool_use blocks require `id` and `name`", 400);
        }
        blocks.push({ type: "tool_use", id, name, input: b.input ?? {} });
        continue;
      }

      if (b.type === "tool_result") {
        const toolUseId = typeof b.tool_use_id === "string" ? b.tool_use_id : "";
        if (!toolUseId) {
          return errorResponse("tool_result blocks require `tool_use_id`", 400);
        }
        const serialised = JSON.stringify(b.content ?? "");
        if (serialised.length > MAX_TEXT_CHARS) {
          return errorResponse(`tool_result content exceeds ${MAX_TEXT_CHARS} characters`, 400);
        }
        blocks.push({
          type: "tool_result",
          tool_use_id: toolUseId,
          content: b.content ?? "",
          ...(typeof b.is_error === "boolean" ? { is_error: b.is_error } : {}),
        });
        continue;
      }

      return errorResponse(`Unsupported content block type "${String(b.type)}"`, 400);
    }

    if (blocks.length === 0) {
      return errorResponse("Message content must contain at least one block", 400);
    }
    out.push({ role, content: blocks });
  }

  return out;
}
