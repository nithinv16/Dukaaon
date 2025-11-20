-- Create enquiry_messages table for DukaaOn Website
-- This table stores all enquiries from visitors (seller enquiries, general contact, etc.)

CREATE TABLE IF NOT EXISTS enquiry_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  visitor_name VARCHAR(255) NOT NULL,
  visitor_email VARCHAR(255) NOT NULL,
  visitor_phone VARCHAR(20) NOT NULL,
  visitor_location VARCHAR(255),
  message TEXT NOT NULL,
  enquiry_type VARCHAR(50) DEFAULT 'seller' CHECK (enquiry_type IN ('seller', 'general', 'contact')),
  stakeholder_type VARCHAR(50) CHECK (stakeholder_type IN ('investor', 'retailer', 'wholesaler', 'manufacturer', 'fmcg', 'other')),
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'read', 'responded', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_seller_id ON enquiry_messages(seller_id);
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_status ON enquiry_messages(status);
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_enquiry_type ON enquiry_messages(enquiry_type);
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_stakeholder_type ON enquiry_messages(stakeholder_type);
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_created_at ON enquiry_messages(created_at DESC);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS update_enquiry_messages_updated_at ON enquiry_messages;
CREATE TRIGGER update_enquiry_messages_updated_at
    BEFORE UPDATE ON enquiry_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE enquiry_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow anonymous users to insert enquiries (for website visitors)
CREATE POLICY "Allow anonymous insert on enquiry_messages"
ON enquiry_messages
FOR INSERT
TO anon
WITH CHECK (true);

-- RLS Policy: Allow authenticated users to insert enquiries (for testing/admin)
CREATE POLICY "Allow authenticated insert on enquiry_messages"
ON enquiry_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policy: Allow authenticated users to read all enquiries (for admin dashboard)
CREATE POLICY "Allow authenticated read on enquiry_messages"
ON enquiry_messages
FOR SELECT
TO authenticated
USING (true);

-- RLS Policy: Allow authenticated users to update enquiries (for admin to change status)
CREATE POLICY "Allow authenticated update on enquiry_messages"
ON enquiry_messages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE enquiry_messages IS 'Stores all enquiries from website visitors including seller enquiries and general contact requests';

-- Add comments to columns
COMMENT ON COLUMN enquiry_messages.id IS 'Unique identifier for the enquiry';
COMMENT ON COLUMN enquiry_messages.seller_id IS 'Reference to profiles table (seller) if this is a seller-specific enquiry (nullable for general enquiries)';
COMMENT ON COLUMN enquiry_messages.visitor_name IS 'Name of the visitor submitting the enquiry';
COMMENT ON COLUMN enquiry_messages.visitor_email IS 'Email address of the visitor';
COMMENT ON COLUMN enquiry_messages.visitor_phone IS 'Phone number of the visitor';
COMMENT ON COLUMN enquiry_messages.visitor_location IS 'Location/city of the visitor';
COMMENT ON COLUMN enquiry_messages.message IS 'The enquiry message content';
COMMENT ON COLUMN enquiry_messages.enquiry_type IS 'Type of enquiry: seller (about specific seller), general, or contact';
COMMENT ON COLUMN enquiry_messages.stakeholder_type IS 'Type of stakeholder for contact enquiries: investor, retailer, wholesaler, manufacturer, fmcg, or other';
COMMENT ON COLUMN enquiry_messages.status IS 'Current status: new, read, responded, or closed';
COMMENT ON COLUMN enquiry_messages.created_at IS 'Timestamp when the enquiry was created';
COMMENT ON COLUMN enquiry_messages.updated_at IS 'Timestamp when the enquiry was last updated';
