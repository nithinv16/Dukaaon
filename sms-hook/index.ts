// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("SMS Hook Function Started")

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

Deno.serve(async (req) => {
  try {
    const payload = await req.text()
    const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRETS')
    const headers = Object.fromEntries(req.headers)
    const wh = new Webhook(hookSecret)
    
    // Verify the webhook signature and get the raw payload
    const verifiedPayload = wh.verify(payload, headers)
    
    // Parse the JSON payload
    const data = JSON.parse(payload)
    
    // Extract data from the correct Supabase Auth Hook structure
    const phoneNumber = data.user.phone
    const otpToken = data.sms.otp
    
    console.log(`Sending OTP ${otpToken} to ${phoneNumber}`)
    
    const authKey = Deno.env.get('AUTHKEY')
    const templateId = '24603' // DLT Template ID
    const smsContent = `Use ${otpToken} as your OTP to access your Dukaaon, OTP is confidential and valid for 5 mins This sms sent by authkey.io`
    const senderId = 'AUTHKY'
    
    const authKeyApiUrl = 'https://console.authkey.io/restapi/requestjson.php'
    
    const requestBody = {
      mobile: phoneNumber,
      country_code: '91',
      sender: senderId,
      sid: templateId,
      otp: otpToken,
      company: 'DukaaOn'
    }
    
    console.log(`Making API call to: ${authKeyApiUrl}`)
    console.log(`Request body:`, JSON.stringify(requestBody))
    
    const smsResponse = await fetch(authKeyApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authKey}`
      },
      body: JSON.stringify(requestBody)
    })
    
    const smsResult = await smsResponse.text()
    
    console.log(`AuthKey API response: ${smsResult}`)
    
    if (!smsResponse.ok) {
      console.error(`SMS sending failed: ${smsResult}`)
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', details: smsResult }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
    
    console.log('SMS sent successfully')
    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent successfully' }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
    
  } catch (error) {
    console.error(`Error in SMS Hook: ${error.message}`)
    return new Response(
      JSON.stringify({ error: 'Webhook verification failed', details: error.message }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }
})