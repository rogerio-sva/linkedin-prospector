-- Add delivery_delayed_at column for tracking delayed emails
ALTER TABLE public.email_sends ADD COLUMN IF NOT EXISTS delivery_delayed_at timestamp with time zone;