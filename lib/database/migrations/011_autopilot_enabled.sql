-- Add enabled toggle to autopilot_settings
ALTER TABLE autopilot_settings
ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
