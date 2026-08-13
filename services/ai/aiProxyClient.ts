/**
 * Client for the server-side AI proxy edge functions.
 *
 * Every AI/ML provider call goes through here. Nothing in the app holds a
 * provider credential: `EXPO_PUBLIC_*` variables are inlined into the JS bundle
 * by Metro as string literals, so a key held that way is recoverable from any
 * shipped APK. AWS credentials live only in Supabase function secrets.
 *
 * Server counterparts:
 *   supabase/functions/ai-translate  AWS Translate + Comprehend
 *   supabase/functions/ai-ocr        AWS Textract
 *   supabase/functions/ai-chat       Bedrock (Claude)
 *
 * All three require a verified JWT and enforce a per-user quota, so callers must
 * be prepared for `AiProxyError` with `code === 'RATE_LIMITED'`.
 */

import { supabase } from '../supabase/supabase';
import type { SupportedLanguage } from '../translationService';

export type AiProxyErrorCode =
  | 'RATE_LIMITED'
  | 'AWS_UNCONFIGURED'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_THROTTLED'
  | 'PROVIDER_REJECTED'
  | 'UNREADABLE_IMAGE'
  | 'IMAGE_TOO_LARGE'
  | 'MODEL_NOT_ALLOWED'
  | 'RATE_LIMIT_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export class AiProxyError extends Error {
  constructor(
    message: string,
    readonly code: AiProxyErrorCode = 'UNKNOWN',
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'AiProxyError';
  }

  /** True when retrying later could plausibly succeed. */
  get isTransient(): boolean {
    return (
      this.code === 'RATE_LIMITED' ||
      this.code === 'PROVIDER_TIMEOUT' ||
      this.code === 'PROVIDER_THROTTLED' ||
      this.code === 'RATE_LIMIT_UNAVAILABLE'
    );
  }
}

/**
 * Invoke an edge function and normalise its failure modes.
 *
 * supabase-js reports a non-2xx as a `FunctionsHttpError` whose useful detail is
 * in `context`, a `Response`. Without reading that body the caller only ever
 * sees "Edge Function returned a non-2xx status code", which is why the previous
 * integrations were so hard to diagnose.
 */
async function invoke<TResponse>(
  functionName: string,
  body: Record<string, unknown>
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    let payload: { error?: string; code?: AiProxyErrorCode; retry_after_seconds?: number } = {};

    const context = (error as { context?: unknown }).context;
    if (context && typeof (context as Response).json === 'function') {
      try {
        payload = await (context as Response).json();
      } catch {
        // Body absent or not JSON — fall through to the generic message.
      }
    }

    const status = (context as Response | undefined)?.status;
    const code: AiProxyErrorCode =
      payload.code ?? (status === 401 || status === 403 ? 'UNAUTHORIZED' : 'UNKNOWN');

    throw new AiProxyError(
      payload.error ?? error.message ?? `${functionName} failed`,
      code,
      payload.retry_after_seconds
    );
  }

  if (data == null) {
    throw new AiProxyError(`${functionName} returned an empty response`);
  }

  return data as TResponse;
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

/**
 * Translate a batch of strings.
 *
 * Always send a batch, even of one: the proxy fans out to AWS Translate with
 * bounded concurrency, so one request here is much cheaper than N requests from
 * the device. Empty/whitespace entries are returned unchanged and are not billed.
 *
 * Returned array is positionally aligned with `texts`.
 */
export async function proxyTranslate(
  texts: string[],
  target: SupportedLanguage,
  source: SupportedLanguage = 'en'
): Promise<string[]> {
  if (texts.length === 0) return [];

  const { translations } = await invoke<{ translations: string[] }>('ai-translate', {
    action: 'translate',
    texts,
    target,
    source,
  });

  if (!Array.isArray(translations) || translations.length !== texts.length) {
    throw new AiProxyError('ai-translate returned a misaligned translation array');
  }

  return translations;
}

export async function proxyDetectLanguage(
  text: string
): Promise<{ language: string; confidence: number }> {
  return invoke<{ language: string; confidence: number }>('ai-translate', {
    action: 'detect',
    text,
  });
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

export interface OcrLine {
  text: string;
  confidence: number;
}

export interface OcrResult {
  text: string;
  lines: OcrLine[];
  blocks: number;
}

/** `imageBase64` may include or omit a `data:image/...;base64,` prefix. */
export async function proxyOcr(imageBase64: string): Promise<OcrResult> {
  return invoke<OcrResult>('ai-ocr', { image: imageBase64 });
}

// ---------------------------------------------------------------------------
// Chat / agent
// ---------------------------------------------------------------------------

export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown; is_error?: boolean };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ChatContentBlock[];
}

/** Claude tool schema: describes a function the *client* executes locally. */
export interface ChatTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface ChatResult {
  /**
   * Raw Claude content blocks. Consumers that drive function calling must read
   * this rather than `text`, since `tool_use` blocks carry no text.
   */
  content: Array<{ type?: string; text?: string; [key: string]: unknown }>;
  /** Convenience concatenation of the text blocks. */
  text: string;
  stopReason: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * The model id is deliberately not a parameter. The proxy allow-lists model ids
 * server-side; leaving the choice to the client would let a tampered build select
 * the most expensive model the AWS account can reach. Token ceilings are clamped
 * server-side for the same reason.
 */
export async function proxyChat(options: {
  messages: ChatMessage[];
  system?: string;
  tools?: ChatTool[];
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatResult> {
  return invoke<ChatResult>('ai-chat', options);
}
