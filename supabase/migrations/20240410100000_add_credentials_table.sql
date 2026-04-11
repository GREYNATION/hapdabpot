-- Migration: Add credentials table
-- Created: 2026-04-10

CREATE TABLE IF NOT EXISTS credentials (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    service TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by key
CREATE INDEX IF NOT EXISTS idx_credentials_key ON credentials(key);

-- Add a trigger to update 'updated_at' on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_credentials_updated_at
BEFORE UPDATE ON credentials
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Optional: Enable RLS
-- ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service role to manage credentials" ON credentials
-- USING (auth.role() = 'service_role');
