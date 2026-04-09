-- ============================================================
-- TAKAM — Migration 008: Billing Lifecycle & Downgrades
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- When premium_expires_at is cleared/null or in the past, the user is technically Free.
-- We enforce this functionally at the frontend launch wrapper for now.
