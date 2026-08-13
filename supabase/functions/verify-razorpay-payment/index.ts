// Supabase Edge Function to verify Razorpay payment signature
// This provides secure server-side payment verification
// AND is the ONLY writer of payment_status = 'paid' (via mark_order_paid RPC)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import crypto from "node:crypto";

const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") || "";

interface VerifyPaymentRequest {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  order_id?: string; // Our internal order ID (single-seller)
  master_order_id?: string; // Our internal master order ID (multi-seller)
  amount?: number; // Payment amount for transaction record
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client using caller's auth (anon key + user JWT)
    // Used ONLY for ownership checks — RLS ensures "this order belongs to this user"
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    const body: VerifyPaymentRequest = await req.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      order_id,
      master_order_id,
      amount,
    } = body;

    // Validate inputs: require the Razorpay triple
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ error: "Missing required Razorpay fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate: exactly one of order_id or master_order_id must be provided
    if (!order_id && !master_order_id) {
      return new Response(
        JSON.stringify({ error: "Either order_id or master_order_id must be provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (order_id && master_order_id) {
      return new Response(
        JSON.stringify({ error: "Only one of order_id or master_order_id should be provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if Razorpay key secret is configured
    if (!RAZORPAY_KEY_SECRET) {
      console.error("Razorpay key secret not configured");
      return new Response(
        JSON.stringify({
          error: "Razorpay credentials not configured",
          message: "Please set RAZORPAY_KEY_SECRET in Supabase secrets",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify payment signature
    // Razorpay signature format: HMAC SHA256 of (razorpay_order_id + "|" + razorpay_payment_id)
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    const isSignatureValid = generatedSignature === razorpay_signature;

    if (!isSignatureValid) {
      console.error("Invalid payment signature", {
        expected: generatedSignature,
        received: razorpay_signature,
      });
      // Return HTTP 400 on signature mismatch — a careless caller cannot mistake this for success
      return new Response(
        JSON.stringify({
          verified: false,
          error: "Invalid payment signature",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // -------------------------------------------------------------------------
    // Ownership check: verify the order belongs to the authenticated user.
    // Uses the caller's auth (anon-key client) so RLS enforces access.
    // -------------------------------------------------------------------------

    if (order_id) {
      // Single-seller: look up in orders table
      const { data: order, error: orderError } = await supabaseClient
        .from("orders")
        .select("id, user_id, payment_status")
        .eq("id", order_id)
        .eq("user_id", user.id)
        .single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: "Order not found or access denied" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else if (master_order_id) {
      // Multi-seller: look up in master_orders table
      const { data: masterOrder, error: masterOrderError } = await supabaseClient
        .from("master_orders")
        .select("id, user_id, payment_status")
        .eq("id", master_order_id)
        .eq("user_id", user.id)
        .single();

      if (masterOrderError || !masterOrder) {
        return new Response(
          JSON.stringify({ error: "Master order not found or access denied" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // -------------------------------------------------------------------------
    // Paid transition: use service_role client to call mark_order_paid RPC.
    // This is the ONLY path that writes payment_status = 'paid'.
    // -------------------------------------------------------------------------

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY not configured");
      return new Response(
        JSON.stringify({
          verified: false,
          error: "Server configuration error — cannot complete payment transition",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseServiceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
    );

    const { data: rpcResult, error: rpcError } = await supabaseServiceClient.rpc(
      "mark_order_paid",
      {
        p_order_id: order_id || null,
        p_master_order_id: master_order_id || null,
        p_razorpay_payment_id: razorpay_payment_id,
        p_amount: amount || null,
      }
    );

    if (rpcError) {
      console.error("mark_order_paid RPC failed:", rpcError);
      return new Response(
        JSON.stringify({
          verified: false,
          error: "Payment verified but order update failed — please retry",
          code: "MARK_ORDER_PAID_FAILED",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // -------------------------------------------------------------------------
    // Success: signature valid, ownership confirmed, order marked paid.
    // -------------------------------------------------------------------------

    return new Response(
      JSON.stringify({
        verified: true,
        ...(order_id ? { order_id } : { master_order_id }),
        payment_id: razorpay_payment_id,
        message: "Payment signature verified and order marked as paid",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error verifying payment:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
