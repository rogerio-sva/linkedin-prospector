-- Function to find contacts with bounced emails (case-insensitive matching)
CREATE OR REPLACE FUNCTION public.find_contacts_with_bounced_emails()
RETURNS TABLE(
  id uuid,
  email text,
  personal_email text,
  linkedin_url text,
  base_id uuid,
  full_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT c.id, c.email, c.personal_email, c.linkedin_url, c.base_id, c.full_name
  FROM contacts c
  WHERE (
    c.email IS NOT NULL AND LOWER(c.email) IN (
      SELECT LOWER(se.email) FROM suppressed_emails se 
      WHERE se.bounce_type ILIKE '%permanent%' 
         OR se.reason IN ('complaint', 'hard_bounce', 'bounce')
    )
  )
  OR (
    c.personal_email IS NOT NULL AND LOWER(c.personal_email) IN (
      SELECT LOWER(se.email) FROM suppressed_emails se 
      WHERE se.bounce_type ILIKE '%permanent%' 
         OR se.reason IN ('complaint', 'hard_bounce', 'bounce')
    )
  );
$$;