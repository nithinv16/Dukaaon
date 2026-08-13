/**
 * Translation proxy — AWS Translate + Comprehend.
 *
 * Replaces the previous direct-from-client Azure Translator calls. The Azure
 * subscription key was read from `EXPO_PUBLIC_AZURE_TRANSLATOR_KEY` with a
 * hardcoded fallback, which meant it was inlined into the JS bundle and
 * recoverable from any shipped APK. AWS credentials now live only in this
 * function's environment.
 *
 * Actions:
 *   { action: 'translate', texts: string[], target: lang, source?: lang }
 *   { action: 'detect',    text: string }
 *
 * `translate` deliberately accepts an array so the client keeps making one
 * request per batch. AWS Translate has no synchronous batch action — Azure
 * accepted 100 texts per request — so the fan-out happens here, with bounded
 * concurrency, rather than as N round trips from the device.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticate,
  consumeRateLimit,
  errorResponse,
  handlePreflight,
  jsonResponse,
  parseJsonBody,
  type AuthedRequest,
} from "../_shared/guard.ts";
import { AwsError, awsConfigError, awsJsonRequest, mapWithConcurrency } from "../_shared/aws.ts";

const FUNCTION_NAME = "ai-translate";

/** Mirrors SupportedLanguage in services/translationService.ts. */
const SUPPORTED_LANGUAGES = new Set(["en", "hi", "ml", "ta", "te", "kn", "mr", "bn"]);

// Caps are enforced before anything reaches AWS. AWS Translate itself rejects
// input over 10k bytes per call; these bounds also keep one request from
// consuming the whole rate-limit window.
const MAX_BODY_BYTES = 256 * 1024;
const MAX_TEXTS_PER_REQUEST = 100;
const MAX_CHARS_PER_TEXT = 5_000;
const CONCURRENCY = 8;

interface TranslateBody {
  action?: "translate" | "detect";
  texts?: unknown;
  text?: unknown;
  target?: unknown;
  source?: unknown;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (awsConfigError) {
    console.error(awsConfigError);
    return errorResponse("Translation service is not configured", 503, "AWS_UNCONFIGURED");
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  const parsed = await parseJsonBody<TranslateBody>(req, MAX_BODY_BYTES);
  if (parsed instanceof Response) return parsed;

  const action = parsed.action ?? "translate";

  try {
    if (action === "detect") {
      return await handleDetect(parsed, auth);
    }
    if (action === "translate") {
      return await handleTranslate(parsed, auth);
    }
    return errorResponse(`Unknown action "${action}"`, 400);
  } catch (error) {
    if (error instanceof AwsError) {
      // Log the detail, return a generic message: AWS error bodies can echo
      // request content and account identifiers.
      console.error(`${FUNCTION_NAME} ${error.service} error ${error.status}: ${error.detail}`);
      const status = error.status === 400 ? 400 : 502;
      return errorResponse("Translation provider error", status, "PROVIDER_ERROR");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse("Translation provider timed out", 504, "PROVIDER_TIMEOUT");
    }
    console.error(`${FUNCTION_NAME} unexpected error:`, error);
    return errorResponse("Internal server error", 500);
  }
});

async function handleTranslate(body: TranslateBody, auth: AuthedRequest): Promise<Response> {
  const target = String(body.target ?? "");
  const source = String(body.source ?? "en");

  if (!SUPPORTED_LANGUAGES.has(target)) {
    return errorResponse(`Unsupported target language "${target}"`, 400);
  }
  if (!SUPPORTED_LANGUAGES.has(source)) {
    return errorResponse(`Unsupported source language "${source}"`, 400);
  }

  if (!Array.isArray(body.texts)) {
    return errorResponse("`texts` must be an array of strings", 400);
  }
  if (body.texts.length === 0) {
    return jsonResponse({ translations: [] });
  }
  if (body.texts.length > MAX_TEXTS_PER_REQUEST) {
    return errorResponse(`At most ${MAX_TEXTS_PER_REQUEST} texts per request`, 400);
  }

  const texts: string[] = [];
  for (const candidate of body.texts) {
    if (typeof candidate !== "string") {
      return errorResponse("`texts` must contain only strings", 400);
    }
    if (candidate.length > MAX_CHARS_PER_TEXT) {
      return errorResponse(`Each text must be at most ${MAX_CHARS_PER_TEXT} characters`, 400);
    }
    texts.push(candidate);
  }

  // Charge one unit per text, not per request: otherwise a 100-text batch costs
  // the same quota as translating a single word.
  const billable = texts.filter((t) => t.trim().length > 0).length;
  const limited = await consumeRateLimit(auth, FUNCTION_NAME, Math.max(1, billable));
  if (limited) return limited;

  if (source === target) {
    return jsonResponse({ translations: texts });
  }

  const translations = await mapWithConcurrency(texts, CONCURRENCY, async (text) => {
    // Preserve empty/whitespace entries positionally without paying for a call.
    if (!text.trim()) return text;

    const result = await awsJsonRequest<{ TranslatedText?: string }>(
      "translate",
      "AWSShineFrontendService_20170701.TranslateText",
      { Text: text, SourceLanguageCode: source, TargetLanguageCode: target }
    );

    // Fall back to the original string rather than an empty one: a missing
    // translation should degrade to untranslated text, not to blank UI.
    return result.TranslatedText ?? text;
  });

  return jsonResponse({ translations });
}

async function handleDetect(body: TranslateBody, auth: AuthedRequest): Promise<Response> {
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return errorResponse("`text` is required", 400);
  }
  if (text.length > MAX_CHARS_PER_TEXT) {
    return errorResponse(`\`text\` must be at most ${MAX_CHARS_PER_TEXT} characters`, 400);
  }

  const limited = await consumeRateLimit(auth, FUNCTION_NAME, 1);
  if (limited) return limited;

  const result = await awsJsonRequest<{
    Languages?: Array<{ LanguageCode?: string; Score?: number }>;
  }>("comprehend", "Comprehend_20171127.DetectDominantLanguage", { Text: text });

  const best = (result.Languages ?? [])
    .slice()
    .sort((a, b) => (b.Score ?? 0) - (a.Score ?? 0))[0];

  return jsonResponse({
    language: best?.LanguageCode ?? "en",
    confidence: best?.Score ?? 0,
  });
}
