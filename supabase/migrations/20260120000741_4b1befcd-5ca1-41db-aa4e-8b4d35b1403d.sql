-- Phase 1: Unify bases - Move contacts from recovered base to main base
-- Source: "Advogados Brasil - Dataset Recuperado" (9eb43f52-f862-43c2-a359-25c66d5e0eac)
-- Target: "Advogados Brasil" (de04814e-8ce0-4572-8bca-31df84eb8774)

-- Insert contacts from recovered base that don't exist in main base
-- Check both linkedin_url AND email to avoid duplicates
INSERT INTO contacts (
  base_id, first_name, last_name, full_name, job_title, email, personal_email,
  mobile_number, company_phone, linkedin_url, company_name, company_website,
  industry, city, state, country, seniority_level, full_data, crm_stage
)
SELECT 
  'de04814e-8ce0-4572-8bca-31df84eb8774', -- target base
  src.first_name, src.last_name, src.full_name, src.job_title, src.email, src.personal_email,
  src.mobile_number, src.company_phone, src.linkedin_url, src.company_name, src.company_website,
  src.industry, src.city, src.state, src.country, src.seniority_level, src.full_data, 'Novo Lead'
FROM contacts src
WHERE src.base_id = '9eb43f52-f862-43c2-a359-25c66d5e0eac'
  -- Exclude if linkedin_url already exists in target
  AND (src.linkedin_url IS NULL OR src.linkedin_url NOT IN (
    SELECT linkedin_url FROM contacts 
    WHERE base_id = 'de04814e-8ce0-4572-8bca-31df84eb8774' 
    AND linkedin_url IS NOT NULL
  ))
  -- Exclude if email already exists in target
  AND (src.email IS NULL OR src.email NOT IN (
    SELECT email FROM contacts 
    WHERE base_id = 'de04814e-8ce0-4572-8bca-31df84eb8774' 
    AND email IS NOT NULL
  ));

-- Delete all contacts from the recovered base (now migrated)
DELETE FROM contacts WHERE base_id = '9eb43f52-f862-43c2-a359-25c66d5e0eac';

-- Delete the recovered base itself
DELETE FROM bases WHERE id = '9eb43f52-f862-43c2-a359-25c66d5e0eac';

-- Phase 2: Clean non-lawyers from the unified base
DELETE FROM contacts 
WHERE base_id = 'de04814e-8ce0-4572-8bca-31df84eb8774'
  AND (
    -- Assistants
    LOWER(job_title) LIKE '%assistente%'
    OR LOWER(job_title) LIKE '%auxiliar%'
    -- Secretaries
    OR LOWER(job_title) LIKE '%secretári%'
    OR LOWER(job_title) LIKE '%secretario%'
    OR LOWER(job_title) LIKE '%secretaria%'
    -- Interns
    OR LOWER(job_title) LIKE '%estagiári%'
    OR LOWER(job_title) LIKE '%estagiário%'
    OR LOWER(job_title) LIKE '%estagiaria%'
    -- Content reviewers (non-legal)
    OR LOWER(job_title) LIKE 'revisor%'
    -- Law firms as contacts
    OR LOWER(job_title) LIKE 'escritório de advocacia%'
    OR LOWER(job_title) = 'law firm'
    -- Non-legal C-level
    OR LOWER(job_title) LIKE 'chief commercial officer%'
    OR LOWER(job_title) LIKE 'chief creative officer%'
    OR LOWER(job_title) LIKE 'chief communications officer%'
    -- Other non-legal roles
    OR LOWER(job_title) LIKE '%recepcionista%'
    OR LOWER(job_title) LIKE '%office boy%'
    OR LOWER(job_title) LIKE '%menor aprendiz%'
    OR LOWER(job_title) LIKE '%jovem aprendiz%'
  )
  -- Preserve anyone with lawyer indicators in their title
  AND LOWER(job_title) NOT LIKE '%advogad%'
  AND LOWER(job_title) NOT LIKE '%lawyer%'
  AND LOWER(job_title) NOT LIKE '%attorney%'
  AND LOWER(job_title) NOT LIKE '%jurídic%'
  AND LOWER(job_title) NOT LIKE '%juridic%'
  AND LOWER(job_title) NOT LIKE '%legal%';