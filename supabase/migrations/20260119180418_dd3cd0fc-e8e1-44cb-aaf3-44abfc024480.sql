-- Add sender_domain column to email_sends table to track which Resend account was used
ALTER TABLE email_sends ADD COLUMN sender_domain text;