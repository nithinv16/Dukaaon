/**
 * AWS request signing for edge functions.
 *
 * The whole point of this module is that AWS credentials exist **only** here, in
 * Deno environment secrets. Nothing AWS-related may be read by client code: an
 * `EXPO_PUBLIC_*` variable is inlined into the JS bundle by Metro as a string
 * literal and is trivially recoverable from a shipped APK, so a long-lived IAM
 * secret held that way is equivalent to a published one.
 *
 * Set these with:
 *   supabase secrets set AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=...
 *
 * The IAM principal behind these credentials should be scoped to exactly the
 * actions the proxies need and nothing else:
 *   translate:TranslateText
 *   comprehend:DetectDominantLanguage
 *   textract:DetectDocumentText
 *   bedrock:InvokeModel   (restricted to the specific model ARNs in use)
 */

import { AwsClient } from "npm:aws4fetch@1.0.20";

const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID") ?? "";
const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY") ?? "";
const sessionToken = Deno.env.get("AWS_SESSION_TOKEN") ?? undefined;

export const AWS_REGION = Deno.env.get("AWS_REGION") ?? "us-east-1";

/** Null when AWS is unconfigured, so callers can return 503 rather than 500. */
export const awsConfigError: string | null =
  !accessKeyId || !secretAccessKey
    ? "AWS credentials are not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY as Supabase function secrets."
    : null;

const client = awsConfigError
  ? null
  : new AwsClient({ accessKeyId, secretAccessKey, sessionToken, region: AWS_REGION });

export class AwsError extends Error {
  constructor(
    readonly service: string,
    readonly status: number,
    readonly detail: string
  ) {
    super(`${service} returned ${status}`);
    this.name = "AwsError";
  }
}

/**
 * Call a JSON-1.1 AWS service action (Translate, Comprehend, Textract).
 *
 * `target` is the `X-Amz-Target` value, e.g.
 * `AWSShineFrontendService_20170701.TranslateText`.
 */
export async function awsJsonRequest<T>(
  service: "translate" | "comprehend" | "textract",
  target: string,
  payload: unknown,
  timeoutMs = 15_000
): Promise<T> {
  if (!client) throw new Error(awsConfigError ?? "AWS unconfigured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.fetch(`https://${service}.${AWS_REGION}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": target,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Deliberately not forwarded to the client verbatim — AWS error bodies can
      // echo request content and account identifiers.
      const detail = await response.text();
      throw new AwsError(service, response.status, detail.slice(0, 500));
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Invoke a Bedrock model. Returns the parsed response body. */
export async function bedrockInvoke<T>(
  modelId: string,
  body: unknown,
  timeoutMs = 60_000
): Promise<T> {
  if (!client) throw new Error(awsConfigError ?? "AWS unconfigured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.fetch(
      `https://bedrock-runtime.${AWS_REGION}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new AwsError("bedrock", response.status, detail.slice(0, 500));
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run tasks with bounded concurrency, preserving input order.
 *
 * AWS Translate has no synchronous batch action — unlike Azure Translator, which
 * accepted up to 100 texts per request. Fanning out here keeps the *client*
 * contract at one request per batch instead of pushing N requests onto the
 * device, while the limit stops a large batch from exhausting the function's
 * socket budget or tripping AWS throttling.
 */
export async function mapWithConcurrency<In, Out>(
  items: In[],
  limit: number,
  task: (item: In, index: number) => Promise<Out>
): Promise<Out[]> {
  const results = new Array<Out>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
