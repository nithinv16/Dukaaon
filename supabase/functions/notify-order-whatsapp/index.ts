/**
 * Order notification proxy — WhatsApp via AuthKey.io.
 *
 * Replaces client-side sending, which read `EXPO_PUBLIC_AUTHKEY_API_KEY` (with a
 * live key hardcoded as a fallback) and passed the recipient phone number and
 * message variables straight from the device.
 *
 * Two problems with that, only one of which is the leaked key:
 *
 *   1. The AuthKey key was inlined into the JS bundle, so anyone could extract it
 *      and send messages billed to this account.
 *   2. Even with a proxied key, accepting `{ phone, template, variables }` from a
 *      client would let any authenticated user send arbitrary WhatsApp template
 *      messages to arbitrary numbers — a spam and phishing vector wearing our
 *      sender identity.
 *
 * So this function accepts only an order id. It verifies the caller owns that
 * order under RLS, then derives the recipients (the sellers on the order) and the
 * message content from the database. The client cannot choose who gets messaged
 * or what it says.
 *
 * Request:  { master_order_id } | { order_id }
 * Response: { sent: number, failed: number, results: [{ seller_id, success, error? }] }
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

const FUNCTION_NAME = "notify-order-whatsapp";

const AUTHKEY_API_KEY = Deno.env.get("AUTHKEY_API_KEY") ?? "";
const AUTHKEY_URL = "https://console.authkey.io/restapi/requestjson.php";

/**
 * Allow-listed notification kinds, each mapped to a template key in
 * whatsapp_template_config. The client picks a `kind`, never a template id or a
 * recipient — so it cannot address an arbitrary number or send arbitrary copy.
 */
const NOTIFICATION_KINDS = {
  new_order: {
    templateKey: "NEW_ORDER_RECEIVED",
    // Variables the template expects, built from DB values only.
    build: (ctx: MessageContext) => ({
      "1": ctx.orderNumber,
      "2": ctx.buyerName,
      "3": `₹${ctx.totalAmount.toLocaleString("en-IN")}`,
      "4": ctx.itemsSummary,
    }),
  },
  cancelled_by_retailer: {
    templateKey: "ORDER_CANCELLED_BY_RETAILER_to_seller",
    build: (ctx: MessageContext) => ({
      "1": ctx.sellerName,
      "2": ctx.orderNumber,
      "3": ctx.buyerName.slice(0, 30),
      "4": ctx.paymentStatusLabel,
      "5": new Date().toLocaleDateString("en-IN"),
    }),
  },
} as const;

type NotificationKind = keyof typeof NOTIFICATION_KINDS;

interface MessageContext {
  orderNumber: string;
  buyerName: string;
  sellerName: string;
  totalAmount: number;
  itemsSummary: string;
  paymentStatusLabel: string;
}

const MAX_BODY_BYTES = 4 * 1024;
const MAX_ITEMS_IN_MESSAGE = 5;

interface NotifyBody {
  master_order_id?: unknown;
  order_id?: unknown;
  kind?: unknown;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (!AUTHKEY_API_KEY) {
    console.error("AUTHKEY_API_KEY is not configured");
    return errorResponse("Notification service is not configured", 503, "AUTHKEY_UNCONFIGURED");
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  const parsed = await parseJsonBody<NotifyBody>(req, MAX_BODY_BYTES);
  if (parsed instanceof Response) return parsed;

  const masterOrderId = typeof parsed.master_order_id === "string" ? parsed.master_order_id : null;
  const orderId = typeof parsed.order_id === "string" ? parsed.order_id : null;

  if (!masterOrderId && !orderId) {
    return errorResponse("Either master_order_id or order_id is required", 400);
  }
  if (masterOrderId && orderId) {
    return errorResponse("Provide only one of master_order_id or order_id", 400);
  }

  const kind = (typeof parsed.kind === "string" ? parsed.kind : "new_order") as NotificationKind;
  if (!Object.prototype.hasOwnProperty.call(NOTIFICATION_KINDS, kind)) {
    return errorResponse(`Unknown notification kind "${kind}"`, 400);
  }
  const notification = NOTIFICATION_KINDS[kind];

  const limited = await consumeRateLimit(auth, FUNCTION_NAME, 1);
  if (limited) return limited;

  const { admin } = auth;

  try {
    // -----------------------------------------------------------------------
    // Ownership. Read through the caller's own JWT so RLS decides, rather than
    // comparing user ids ourselves with the service role.
    // -----------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const asCaller = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    if (masterOrderId) {
      const { data, error } = await asCaller
        .from("master_orders")
        .select("id")
        .eq("id", masterOrderId)
        .single();
      if (error || !data) {
        return errorResponse("Order not found or access denied", 404);
      }
    } else {
      const { data, error } = await asCaller
        .from("orders")
        .select("id")
        .eq("id", orderId)
        .single();
      if (error || !data) {
        return errorResponse("Order not found or access denied", 404);
      }
    }

    // -----------------------------------------------------------------------
    // Derive recipients and content server-side.
    // -----------------------------------------------------------------------
    const orderQuery = admin
      .from("orders")
      .select("id, order_number, seller_id, total_amount, items, user_id, payment_status");

    const { data: orders, error: ordersError } = masterOrderId
      ? await orderQuery.eq("master_order_id", masterOrderId)
      : await orderQuery.eq("id", orderId);

    if (ordersError) {
      console.error(`${FUNCTION_NAME}: failed to load orders:`, ordersError.message);
      return errorResponse("Could not load order", 500);
    }
    if (!orders || orders.length === 0) {
      return jsonResponse({ sent: 0, failed: 0, results: [] });
    }

    // Buyer name for the message body.
    const { data: buyer } = await admin
      .from("profiles")
      .select("business_details, phone_number")
      .eq("id", orders[0].user_id)
      .single();

    const buyerName =
      (buyer?.business_details as { shopName?: string } | null)?.shopName ??
      "A customer";

    // Template id from the database, with no hardcoded fallback: sending against
    // a guessed template id produces silent delivery failures.
    const { data: template } = await admin
      .from("whatsapp_template_config")
      .select("authkey_template_id, is_enabled")
      .eq("template_key", notification.templateKey)
      .single();

    if (!template?.authkey_template_id || template.is_enabled === false) {
      console.error(`${FUNCTION_NAME}: template ${notification.templateKey} missing or disabled`);
      return errorResponse("Notification template is not configured", 503, "TEMPLATE_UNCONFIGURED");
    }

    const sellerIds = [...new Set(orders.map((o) => o.seller_id).filter(Boolean))];
    const { data: sellers } = await admin
      .from("seller_details")
      .select("user_id, business_name, phone_number")
      .in("user_id", sellerIds);

    const sellerById = new Map((sellers ?? []).map((s) => [s.user_id, s]));

    const results = await Promise.all(
      orders.map(async (order) => {
        const seller = sellerById.get(order.seller_id);
        const phone = normalisePhone(seller?.phone_number);

        if (!phone) {
          return { seller_id: order.seller_id, success: false, error: "No valid seller phone" };
        }

        const variables = notification.build({
          orderNumber: String(order.order_number ?? ""),
          buyerName,
          sellerName: seller?.business_name ?? "Seller",
          totalAmount: Number(order.total_amount ?? 0),
          itemsSummary: formatItems(order.items),
          paymentStatusLabel:
            order.payment_status === "paid" ? "Paid - Refund processing" : "Unpaid",
        });

        try {
          const response = await fetch(AUTHKEY_URL, {
            method: "POST",
            headers: {
              Authorization: `Basic ${AUTHKEY_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              country_code: "91",
              mobile: phone,
              wid: template.authkey_template_id,
              type: "text",
              variables,
            }),
          });

          const text = await response.text();
          if (!response.ok) {
            console.error(`${FUNCTION_NAME}: AuthKey ${response.status} for order ${order.id}`);
            return { seller_id: order.seller_id, success: false, error: "Delivery failed" };
          }

          // Best-effort audit row. A logging failure must not fail the send.
          await admin
            .from("whatsapp_template_sends")
            .insert({
              template_key: notification.templateKey,
              recipient_phone: phone,
              order_id: order.id,
              status: "sent",
            })
            .then(undefined, () => {});

          return { seller_id: order.seller_id, success: true, response: text.slice(0, 200) };
        } catch (error) {
          console.error(`${FUNCTION_NAME}: send threw for order ${order.id}:`, error);
          return { seller_id: order.seller_id, success: false, error: "Delivery failed" };
        }
      })
    );

    return jsonResponse({
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error(`${FUNCTION_NAME} unexpected error:`, error);
    return errorResponse("Internal server error", 500);
  }
});

/** Reduce to the 10-digit national number AuthKey expects, or null. */
function normalisePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  const national = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(national) ? national : null;
}

/** Compact item summary; templates have a length budget. */
function formatItems(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "See app for details";

  const named = items.slice(0, MAX_ITEMS_IN_MESSAGE).map((item) => {
    const i = item as { name?: unknown; quantity?: unknown; unit?: unknown };
    const name = typeof i.name === "string" ? i.name : "Item";
    const qty = typeof i.quantity === "number" ? i.quantity : 1;
    const unit = typeof i.unit === "string" ? i.unit : "";
    return `${name} x${qty}${unit ? ` ${unit}` : ""}`;
  });

  const remainder = items.length - named.length;
  return named.join(", ") + (remainder > 0 ? ` +${remainder} more` : "");
}
