-- Fase 1: Unificar bases
-- Source: "Gestores Sinistro" (25240e96-97a0-457d-b09c-234b910d03c3)
-- Target: "Gestores e Supervisores de Sinistro/Eventos" (d92deb89-0e76-444d-be98-25642bacd223)

INSERT INTO contacts (
  base_id, first_name, last_name, full_name, job_title, email, personal_email,
  mobile_number, company_phone, linkedin_url, company_name, company_website,
  industry, city, state, country, seniority_level, full_data, crm_stage
)
SELECT 
  'd92deb89-0e76-444d-be98-25642bacd223',
  src.first_name, src.last_name, src.full_name, src.job_title, src.email, src.personal_email,
  src.mobile_number, src.company_phone, src.linkedin_url, src.company_name, src.company_website,
  src.industry, src.city, src.state, src.country, src.seniority_level, src.full_data, 'Novo Lead'
FROM contacts src
WHERE src.base_id = '25240e96-97a0-457d-b09c-234b910d03c3'
  AND (src.linkedin_url IS NULL OR src.linkedin_url NOT IN (
    SELECT linkedin_url FROM contacts 
    WHERE base_id = 'd92deb89-0e76-444d-be98-25642bacd223' 
    AND linkedin_url IS NOT NULL
  ))
  AND (src.email IS NULL OR src.email NOT IN (
    SELECT email FROM contacts 
    WHERE base_id = 'd92deb89-0e76-444d-be98-25642bacd223' 
    AND email IS NOT NULL
  ));

-- Deletar contatos e base origem
DELETE FROM contacts WHERE base_id = '25240e96-97a0-457d-b09c-234b910d03c3';
DELETE FROM bases WHERE id = '25240e96-97a0-457d-b09c-234b910d03c3';

-- Fase 2: Remover APENAS marketing/comunicação
DELETE FROM contacts 
WHERE base_id = 'd92deb89-0e76-444d-be98-25642bacd223'
  AND (
    LOWER(job_title) LIKE '%marketing%'
    OR LOWER(job_title) LIKE '%mkt%'
    OR LOWER(job_title) LIKE '%trade%'
    OR LOWER(job_title) LIKE '%comunicação%'
    OR LOWER(job_title) LIKE '%comunicacao%'
    OR LOWER(job_title) LIKE '%endomarketing%'
    OR LOWER(job_title) LIKE '%patrocínio%'
    OR LOWER(job_title) LIKE '%patrocinio%'
    OR LOWER(job_title) LIKE '%brand%'
    OR LOWER(job_title) LIKE '%marca%'
  )
  AND LOWER(job_title) NOT LIKE '%sinistro%'
  AND LOWER(job_title) NOT LIKE '%claims%'
  AND LOWER(job_title) NOT LIKE '%seguro%'
  AND LOWER(job_title) NOT LIKE '%insurance%'
  AND LOWER(job_title) NOT LIKE '%segurad%';

-- Fase 3: Renomear a base
UPDATE bases 
SET name = 'Gestores de Sinistro/Eventos', 
    description = 'Base unificada de gestores, coordenadores e supervisores de sinistro e eventos no Brasil'
WHERE id = 'd92deb89-0e76-444d-be98-25642bacd223';