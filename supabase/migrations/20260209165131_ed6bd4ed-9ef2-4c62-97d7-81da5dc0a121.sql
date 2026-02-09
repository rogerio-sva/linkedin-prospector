CREATE INDEX IF NOT EXISTS idx_email_sends_resend_id ON public.email_sends (resend_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign_id_status ON public.email_sends (campaign_id, status);