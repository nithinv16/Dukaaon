// Supabase Edge Function to verify Razorpay payment signature
// This provides secure server-side payment verification

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import crypto from "node:crypto";

const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") || "";

interface VerifyPaymentRequest {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  order_id: string; // Our internal order ID
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
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
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: VerifyPaymentRequest = await req.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id } = body;

    // Validate inputs
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !order_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if Razorpay key secret is configured
    if (!RAZORPAY_KEY_SECRET) {
      console.error("Razorpay key secret not configured");
      return new Response(
        JSON.stringify({ 
          error: "Razorpay credentials not configured",
          message: "Please set RAZORPAY_KEY_SECRET in Supabase secrets"
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
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
      return new Response(
        JSON.stringify({ 
          verified: false,
          error: "Invalid payment signature"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify order belongs to user
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("id, user_id, payment_status")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found or access denied" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return verification result
    return new Response(
      JSON.stringify({
        verified: true,
        order_id: order.id,
        payment_id: razorpay_payment_id,
        message: "Payment signature verified successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error verifying payment:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

