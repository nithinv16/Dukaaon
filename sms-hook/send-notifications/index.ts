import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { orderData, deliveryPartnerIds } = await req.json()
  
  // Find nearby online delivery partners
  const { data: partners } = await supabase
    .from('delivery_partners')
    .select('fcm_token, id')
    .in('id', deliveryPartnerIds)
    .eq('is_online', true)
    .not('fcm_token', 'is', null)
  
  // Send FCM notifications
  const notifications = partners.map(partner => ({
    token: partner.fcm_token,
    notification: {
      title: 'New Order Available!',
      body: `Order worth ₹${orderData.amount} nearby`
    },
    data: {
      type: 'new_order',
      orderId: orderData.id,
      distance: (orderData.distance || 0).toString()
    }
  }))
  
  // Send via FCM Admin SDK
  await admin.messaging().sendAll(notifications)
  
  return new Response(JSON.stringify({ success: true }))
})