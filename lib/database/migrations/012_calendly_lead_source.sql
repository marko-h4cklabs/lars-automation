-- Add 'calendly' as a lead source for bookings from non-Instagram users
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'calendly';
