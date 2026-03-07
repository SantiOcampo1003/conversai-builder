-- Refactor leads table for flexible customer information
-- Remove fixed fields and use JSONB for dynamic data based on agent's required_info

-- 1. Rename 'phone' to 'customer_id' (will store WhatsApp phone)
ALTER TABLE leads
RENAME COLUMN phone TO customer_id;

-- 2. Add 'additional_fields' JSONB column for flexible data
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS additional_fields JSONB DEFAULT '{}'::jsonb;

-- 3. Migrate existing data to additional_fields
UPDATE leads
SET additional_fields = jsonb_build_object(
  'nombre', name,
  'email', email,
  'direccion', address
)
WHERE name IS NOT NULL OR email IS NOT NULL OR address IS NOT NULL;

-- 4. Drop old fixed columns (keeping data in additional_fields)
ALTER TABLE leads
DROP COLUMN IF EXISTS name,
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS address;

-- 5. Update constraints
ALTER TABLE leads
ALTER COLUMN customer_id TYPE VARCHAR(255),
ALTER COLUMN customer_id SET NOT NULL;

-- 6. Create index on customer_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);

-- 7. Create index on additional_fields for JSONB queries
CREATE INDEX IF NOT EXISTS idx_leads_additional_fields ON leads USING GIN (additional_fields);

-- 8. Add unique constraint for agent_id + customer_id (one lead per customer per agent)
ALTER TABLE leads
ADD CONSTRAINT unique_agent_customer UNIQUE (agent_id, customer_id);

-- 9. Add comment for documentation
COMMENT ON COLUMN leads.customer_id IS 'WhatsApp phone number (e.g. +573001234567)';
COMMENT ON COLUMN leads.additional_fields IS 'Dynamic JSONB field storing flexible customer data based on agent required_info (e.g. {nombre, edad, email, ciudad, etc.})';
COMMENT ON TABLE leads IS 'Stores customer leads with flexible fields. additional_fields adapts to each agent required_info configuration.';
