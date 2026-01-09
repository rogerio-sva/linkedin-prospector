-- Create suppressed_emails table for global email suppression
CREATE TABLE public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL, -- 'hard_bounce', 'complaint', 'manual'
  source_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  bounce_type TEXT,
  original_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT suppressed_emails_email_unique UNIQUE (email)
);

-- Create index for fast email lookups
CREATE INDEX idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Enable RLS
ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on suppressed_emails"
ON public.suppressed_emails
FOR ALL
USING (true)
WITH CHECK (true);

-- Populate with existing permanent bounces
INSERT INTO public.suppressed_emails (email, reason, source_contact_id, bounce_type, original_error)
SELECT DISTINCT ON (es.recipient_email)
  es.recipient_email,
  'hard_bounce',
  es.contact_id,
  es.bounce_type,
  es.bounce_message
FROM public.email_sends es
WHERE es.bounce_type = 'Permanent'
  AND es.recipient_email IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- Also add emails from complaints
INSERT INTO public.suppressed_emails (email, reason, source_contact_id)
SELECT DISTINCT ON (es.recipient_email)
  es.recipient_email,
  'complaint',
  es.contact_id
FROM public.email_sends es
WHERE es.complained_at IS NOT NULL
  AND es.recipient_email IS NOT NULL
ON CONFLICT (email) DO NOTHING;