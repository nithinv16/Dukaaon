-- Add stakeholder_type column to enquiry_messages table
-- This column is used for contact form enquiries to identify the type of stakeholder

ALTER TABLE enquiry_messages 
ADD COLUMN IF NOT EXISTS stakeholder_type VARCHAR(50) 
CHECK (stakeholder_type IN ('investor', 'retailer', 'wholesaler', 'manufacturer', 'fmcg', 'other'));

-- Add comment to the new column
COMMENT ON COLUMN enquiry_messages.stakeholder_type IS 'Type of stakeholder for contact enquiries: investor, retailer, wholesaler, manufacturer, fmcg, or other';

-- Create index for stakeholder_type for better query performance
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_stakeholder_type ON enquiry_messages(stakeholder_type);
