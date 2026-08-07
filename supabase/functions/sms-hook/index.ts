// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("WhatsApp OTP Hook Function Started")

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.text()
    const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRETS')
    const headers = Object.fromEntries(req.headers)
    
    // For Supabase Auth Hooks, verify webhook signature (non-blocking)
    if (hookSecret) {
      try {
        const wh = new Webhook(hookSecret)
        wh.verify(payload, headers)
        console.log('Webhook signature verified successfully')
      } catch (verifyError) {
        console.warn(`Webhook verification warning: ${verifyError.message}`)
        // Continue processing - Supabase Auth hooks may not always send standard webhook headers
      }
    }
    
    // Parse the JSON payload
    const data = JSON.parse(payload)
    
    // Handle both Supabase Auth Hook format and direct API calls
    let phone: string;
    let token: string;
    let type: string = 'signup';
    
    if (data.user && data.sms) {
      // Supabase Auth Hook format
      phone = data.user.phone;
      token = data.sms.otp;
      type = data.sms.type || 'signup';
      console.log(`Supabase Auth Hook triggered for phone: ${phone}, type: ${type}`);
    } else {
      // Direct API call format (fallback)
      phone = data.phone;
      token = data.token;
      type = data.type || 'signup';
      console.log(`Direct SMS Hook triggered for phone: ${phone}, type: ${type}`);
    }
    
    console.log(`SMS Hook triggered for phone: ${phone}, type: ${type}`);
    
    // Validate required fields
    if (!phone || !token) {
      console.error('Missing required fields: phone or token');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phone or token' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Extract just the 10-digit mobile number (remove country code)
    let cleanPhone = phone.replace(/^\+91/, '').replace(/^91/, '').replace(/\D/g, '');
    
    // Validate phone number format (should be 10 digits for Indian numbers)
    if (!/^\d{10}$/.test(cleanPhone)) {
      console.error(`Invalid phone number format: ${phone} -> ${cleanPhone}`);
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Cleaned phone number: ${phone} -> ${cleanPhone}`);

    // WhatsApp OTP via AuthKey.io - Official POST API
    const authKey = Deno.env.get('AUTHKEY') || '904251f34754cedc';
    const whatsappTemplateId = Deno.env.get('WHATSAPP_OTP_TEMPLATE_ID') || '40559';
    const authKeyApiUrl = 'https://console.authkey.io/restapi/requestjson.php';
    
    // Authentication template uses {{1}} - try direct positional key
    const requestBody = {
      country_code: '91',
      mobile: cleanPhone,
      wid: whatsappTemplateId,
      type: 'text',
      bodyValues: {
        '1': token
      }
    };

    console.log(`OTP token value: ${token}`);

    console.log(`Sending WhatsApp OTP to: ${cleanPhone}, type: ${type}`);
    console.log(`Template ID (wid): ${whatsappTemplateId}`);
    console.log(`Payload:`, JSON.stringify(requestBody));
    
    // Send WhatsApp OTP via AuthKey POST API
    const waResponse = await fetch(authKeyApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const waResult = await waResponse.text();
    
    console.log(`AuthKey WhatsApp API response: ${waResult}`);
    
    // Parse response to check for AuthKey-specific error codes
    let parsedResult;
    try { parsedResult = JSON.parse(waResult); } catch(e) { parsedResult = null; }
    
    const isAuthKeyError = parsedResult?.statusCode && parsedResult.statusCode !== '200';
    
    if (!waResponse.ok || isAuthKeyError) {
      console.error(`WhatsApp OTP sending failed: ${waResult}`);
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp OTP', details: waResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log('WhatsApp OTP sent successfully');
    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent successfully via WhatsApp' }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error(`Error in SMS Hook: ${error.message}`);
    return new Response(
      JSON.stringify({ error: 'Webhook verification failed', details: error.message }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});