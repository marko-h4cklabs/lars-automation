-- Track which Calendly events have been processed (deduplication for polling worker)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_calendly_event_uri ON leads(calendly_event_uri) WHERE calendly_event_uri IS NOT NULL;
