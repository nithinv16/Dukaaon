-- ============================================================================
-- WhatsApp Step 2: Insert default template configurations
-- Run this after Step 1 succeeds
-- ============================================================================

INSERT INTO whatsapp_template_config (template_key, template_name, authkey_template_id, category, description, variable_count, is_automatic, trigger_event, variable_mapping) VALUES

-- Order Management Templates
('NEW_ORDER_RECEIVED', 'New Order Received', '24468', 'order', 'Notify seller of new order', 4, TRUE, 'order.created', 
 '{"1": "orderNumber", "2": "customerName", "3": "totalAmount", "4": "items"}'),
 
('ORDER_CONFIRMED', 'Order Confirmed', NULL, 'order', 'Confirm order to retailer', 4, TRUE, 'order.confirmed',
 '{"1": "customerName", "2": "orderNumber", "3": "sellerName", "4": "eta"}'),
 
('ORDER_REJECTED', 'Order Rejected', NULL, 'order', 'Notify retailer of rejection', 3, TRUE, 'order.rejected',
 '{"1": "customerName", "2": "orderNumber", "3": "reason"}'),
 
('ORDER_PARTIALLY_AVAILABLE', 'Order Partially Available', NULL, 'order', 'Some items out of stock', 5, TRUE, 'order.partial',
 '{"1": "orderNumber", "2": "availableItems", "3": "unavailableItems", "4": "newTotal"}'),
 
('ORDER_READY_FOR_PICKUP', 'Order Ready for Pickup', NULL, 'order', 'Order ready for delivery pickup', 4, TRUE, 'order.ready',
 '{"1": "sellerName", "2": "orderNumber", "3": "pickupLocation", "4": "readyTime"}'),
 
('ORDER_CANCELLED_BY_SELLER', 'Order Cancelled by Seller', NULL, 'order', 'Notify retailer when seller cancels', 4, TRUE, 'order.cancelled.seller',
 '{"1": "customerName", "2": "orderNumber", "3": "reason", "4": "refundInfo"}'),
 
('ORDER_CANCELLED_BY_RETAILER', 'Order Cancelled by Retailer', NULL, 'order', 'Notify seller when retailer cancels', 4, TRUE, 'order.cancelled.retailer',
 '{"1": "customerName", "2": "orderNumber", "3": "refundInfo", "4": "refundDate"}'),
 
('ORDER_SUMMARY_DAILY', 'Daily Order Summary', NULL, 'order', 'Daily order summary for seller', 6, TRUE, 'schedule.daily',
 '{"1": "sellerName", "2": "date", "3": "totalOrders", "4": "totalAmount", "5": "completed", "6": "pending"}'),

-- Payment Templates
('PAYMENT_RECEIVED', 'Payment Received', NULL, 'payment', 'Payment confirmation', 4, TRUE, 'payment.received',
 '{"1": "customerName", "2": "amount", "3": "orderNumber", "4": "remainingBalance"}'),
 
('PAYMENT_REMINDER', 'Payment Reminder', NULL, 'payment', 'Upcoming payment due', 4, TRUE, 'payment.reminder',
 '{"1": "customerName", "2": "amount", "3": "dueDate", "4": "daysLeft"}'),
 
('PAYMENT_OVERDUE', 'Payment Overdue', NULL, 'payment', 'Payment past due', 5, TRUE, 'payment.overdue',
 '{"1": "customerName", "2": "amount", "3": "daysPastDue", "4": "lateFee", "5": "totalDue"}'),
 
('PAYMENT_PARTIAL', 'Partial Payment Received', NULL, 'payment', 'Partial payment received', 5, TRUE, 'payment.partial',
 '{"1": "customerName", "2": "paidAmount", "3": "orderNumber", "4": "remainingBalance", "5": "dueDate"}'),
 
('CREDIT_LIMIT_REACHED', 'Credit Limit Alert', NULL, 'payment', 'Credit limit warning', 4, TRUE, 'credit.limit_warning',
 '{"1": "customerName", "2": "creditLimit", "3": "usedAmount", "4": "available"}'),

-- Delivery Templates
('DELIVERY_ASSIGNED', 'Delivery Partner Assigned', NULL, 'delivery', 'Delivery partner assigned', 4, TRUE, 'delivery.assigned',
 '{"1": "orderNumber", "2": "driverName", "3": "driverPhone", "4": "eta"}'),
 
('DELIVERY_STARTED', 'Delivery Started', NULL, 'delivery', 'Driver picked up order', 4, TRUE, 'delivery.started',
 '{"1": "orderNumber", "2": "driverName", "3": "eta", "4": "trackingLink"}'),
 
('DELIVERY_ARRIVING', 'Delivery Arriving', NULL, 'delivery', 'Driver nearby', 4, TRUE, 'delivery.arriving',
 '{"1": "orderNumber", "2": "minutesAway", "3": "driverName", "4": "driverPhone"}'),
 
('DELIVERY_COMPLETED', 'Delivery Completed', NULL, 'delivery', 'Order delivered', 4, TRUE, 'delivery.completed',
 '{"1": "orderNumber", "2": "totalAmount", "3": "items", "4": "feedbackLink"}'),
 
('DELIVERY_DELAYED', 'Delivery Delayed', NULL, 'delivery', 'Delay notification', 3, TRUE, 'delivery.delayed',
 '{"1": "orderNumber", "2": "newEta", "3": "reason"}'),

-- Marketing Templates
('REORDER_REMINDER', 'Reorder Reminder', NULL, 'marketing', 'Weekly stock purchase reminder', 4, TRUE, 'schedule.weekly_reorder',
 '{"1": "productList", "2": "lastOrderDate", "3": "message", "4": "link"}'),
 
('LOW_STOCK_ALERT', 'Low Stock Alert', NULL, 'marketing', 'Items running low based on patterns', 3, TRUE, 'analytics.low_stock',
 '{"1": "items", "2": "estimatedDaysLeft", "3": "link"}'),
 
('WELCOME_MESSAGE', 'Welcome Message', NULL, 'marketing', 'New user onboarding', 2, TRUE, 'user.registered',
 '{"1": "userName", "2": "welcomeOffer"}'),
 
('INACTIVE_USER', 'Inactive User', NULL, 'marketing', 'Win back inactive users', 4, TRUE, 'schedule.inactive_check',
 '{"1": "userName", "2": "daysSinceOrder", "3": "specialOffer", "4": "link"}'),

-- Support Templates
('SUPPORT_TICKET_CREATED', 'Support Ticket Created', NULL, 'support', 'Complaint registered', 4, TRUE, 'support.created',
 '{"1": "ticketId", "2": "issue", "3": "expectedResolution", "4": "contactInfo"}'),
 
('SUPPORT_TICKET_RESOLVED', 'Support Ticket Resolved', NULL, 'support', 'Issue resolved', 4, TRUE, 'support.resolved',
 '{"1": "ticketId", "2": "resolution", "3": "feedbackLink", "4": "message"}'),
 
('GENERAL_RESPONSE', 'General Response', NULL, 'support', 'Custom support response', 2, FALSE, NULL,
 '{"1": "userName", "2": "message"}')

ON CONFLICT (template_key) DO NOTHING;
