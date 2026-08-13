/**
 * OCR proxy — AWS Textract.
 *
 * Replaces two direct-from-client integrations: Azure Computer Vision
 * (`EXPO_PUBLIC_AZURE_COMPUTER_VISION_KEY`, which had a hardcoded fallback) and
 * Google Cloud Vision (`EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY`). Both keys were
 * inlined into the JS bundle.
 *
 * Request:  { image: "<base64>", mode?: "text" | "lines" }
 * Response: { text: string, lines: Array<{ text, confidence }>, blocks: number }
 *
 * Textract's DetectDocumentText is the right action here: the app scans printed
 * product lists and invoices, which is document text, not scene text. It caps
 * synchronous input at 5 MB and 10 MB base64, so the limits below sit under that.
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
import { AwsError, awsConfigError, awsJsonRequest } from "../_shared/aws.ts";

const FUNCTION_NAME = "ai-ocr";

// Textract synchronous limit is 5 MB of decoded image bytes. Base64 inflates by
// ~4/3, so bound the encoded payload accordingly and leave room for JSON framing.
const MAX_IMAGE_BASE64_CHARS = 7_000_000;
const MAX_BODY_BYTES = 8 * 1024 * 1024;

interface OcrBody {
  image?: unknown;
  mode?: unknown;
}

interface TextractBlock {
  BlockType?: string;
  Text?: string;
  Confidence?: number;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (awsConfigError) {
    console.error(awsConfigError);
    return errorResponse("OCR service is not configured", 503, "AWS_UNCONFIGURED");
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  const parsed = await parseJsonBody<OcrBody>(req, MAX_BODY_BYTES);
  if (parsed instanceof Response) return parsed;

  const image = typeof parsed.image === "string" ? parsed.image.trim() : "";
  if (!image) {
    return errorResponse("`image` (base64) is required", 400);
  }
  if (image.length > MAX_IMAGE_BASE64_CHARS) {
    return errorResponse("Image too large; resize before uploading", 413, "IMAGE_TOO_LARGE");
  }

  // Reject anything that is not plausibly base64 before spending a call. Also
  // strips a data-URL prefix if the client sent one.
  const base64 = image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return errorResponse("`image` must be base64-encoded", 400);
  }

  const limited = await consumeRateLimit(auth, FUNCTION_NAME, 1);
  if (limited) return limited;

  try {
    const result = await awsJsonRequest<{ Blocks?: TextractBlock[] }>(
      "textract",
      "Textract.DetectDocumentText",
      { Document: { Bytes: base64 } },
      30_000
    );

    const blocks = result.Blocks ?? [];
    const lines = blocks
      .filter((b) => b.BlockType === "LINE" && typeof b.Text === "string")
      .map((b) => ({ text: b.Text as string, confidence: (b.Confidence ?? 0) / 100 }));

    return jsonResponse({
      text: lines.map((l) => l.text).join("\n"),
      lines,
      blocks: blocks.length,
    });
  } catch (error) {
    if (error instanceof AwsError) {
      console.error(`${FUNCTION_NAME} textract error ${error.status}: ${error.detail}`);
      // Textract returns 400 for unsupported/corrupt images — that is a client
      // problem and worth distinguishing from a provider outage.
      if (error.status === 400) {
        return errorResponse("Image could not be read", 400, "UNREADABLE_IMAGE");
      }
      return errorResponse("OCR provider error", 502, "PROVIDER_ERROR");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse("OCR provider timed out", 504, "PROVIDER_TIMEOUT");
    }
    console.error(`${FUNCTION_NAME} unexpected error:`, error);
    return errorResponse("Internal server error", 500);
  }
});
