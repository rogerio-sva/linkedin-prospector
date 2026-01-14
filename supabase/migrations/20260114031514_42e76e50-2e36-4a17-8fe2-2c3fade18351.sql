-- Reorganizar posições dos estágios existentes (mover todos para frente)
UPDATE crm_stages SET position = position + 1 WHERE position >= 1;

-- Inserir novo estágio "Email Enviado" na posição 1
INSERT INTO crm_stages (name, color, position) 
VALUES ('Email Enviado', '#3b82f6', 1);

-- Corrigir contatos que têm UUID em vez do nome do estágio
UPDATE contacts 
SET crm_stage = 'Email Enviado' 
WHERE crm_stage = 'bcc045f1-c7b9-4a7a-92fa-49a82092dfa4';

-- Mover todos os contatos que receberam email para "Email Enviado"
UPDATE contacts c
SET crm_stage = 'Email Enviado',
    last_activity_at = COALESCE(c.last_activity_at, (
      SELECT MAX(COALESCE(es.sent_at, es.created_at)) 
      FROM email_sends es 
      WHERE es.contact_id = c.id
    ))
WHERE c.id IN (SELECT DISTINCT contact_id FROM email_sends)
  AND (c.crm_stage = 'Novo Lead' OR c.crm_stage IS NULL OR c.crm_stage = '');