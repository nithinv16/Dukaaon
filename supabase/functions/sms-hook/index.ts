// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("SMS Hook Function Started")

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
    
    // For Supabase Auth Hooks, we need to handle webhook verification
    if (hookSecret) {
      const wh = new Webhook(hookSecret)
      // Verify the webhook signature
      const verifiedPayload = wh.verify(payload, headers)
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

    // Customize message based on SMS type
    let customMessage: string;
    switch (type) {
      case 'signup':
        customMessage = `Welcome to DukaaOn! Your verification code is: ${token}`;
        break;
      case 'recovery':
        customMessage = `DukaaOn account recovery code: ${token}`;
        break;
      case 'email_change':
        customMessage = `DukaaOn email change verification: ${token}`;
        break;
      case 'phone_change':
        customMessage = `DukaaOn phone change verification: ${token}`;
        break;
      default:
        customMessage = `DukaaOn verification code: ${token}`;
    }
    
    // Add expiry information
    customMessage += ' (Valid for 10 minutes)';

    // AuthKey API configuration - using standard SMS API endpoint
    const authKey = Deno.env.get('AUTHKEY') || '904251f34754cedc';
    const templateId = '24603'; // DLT Template ID
    const senderId = 'AUTHKY';
    const authKeyApiUrl = 'https://api.authkey.io/request';
    
    // Use the working message format
    const smsContent = `Use ${token} as your OTP to access your Dukaaon, OTP is confidential and valid for 5 mins This sms sent by authkey.io`;
    
    // Prepare AuthKey API request - try different format based on AuthKey documentation
    const requestBody = {
      authkey: authKey,
      mobiles: cleanPhone,
      message: smsContent,
      sender: senderId,
      route: '4',
      country: '91'
    };

    console.log(`Making API call to: ${authKeyApiUrl}`);
    console.log(`Request body:`, JSON.stringify(requestBody));
    
    // Send SMS via AuthKey API
    const smsResponse = await fetch(authKeyApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const smsResult = await smsResponse.text();
    
    console.log(`AuthKey API response: ${smsResult}`);
    
    if (!smsResponse.ok) {
      console.error(`SMS sending failed: ${smsResult}`);
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', details: smsResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log('SMS sent successfully');
    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent successfully' }),
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