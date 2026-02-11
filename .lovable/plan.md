
# Limpeza de Bounces - Campanha Follow-up 3 Advogados

## Situacao atual

A campanha gerou **4.846 bounces**, sendo:
- **2.711** Permanentes
- **1.877** Suprimidos (bloqueados pelo Resend)
- **255** Transientes
- **3** Indeterminados

Dos bounces permanentes/suprimidos:
- **4.588 contatos** afetados
- **Todos possuem LinkedIn** (nenhum sera deletado)
- **3.172** ainda possuem email preenchido na base (precisam ser limpos)
- **1.416** ja foram limpos em operacoes anteriores
- Todos os emails ja estao na lista de suprimidos (protecao contra reenvio OK)

## O que sera feito

Executar uma query SQL para:

1. **Limpar os campos de email** (`email` e `personal_email` = NULL) dos 3.172 contatos que ainda possuem email
2. **Resetar o estagio CRM** para "Novo Lead" — indicando que estao disponiveis para prospecao via LinkedIn
3. **Registrar atividade** no historico de cada contato (bounce_cleanup)

## Secao tecnica

### Passo 1 — Limpar emails e resetar CRM stage

```sql
UPDATE contacts
SET email = NULL, personal_email = NULL, crm_stage = 'Novo Lead'
WHERE id IN (
  SELECT DISTINCT es.contact_id
  FROM email_sends es
  WHERE es.campaign_id = '83e206de-8946-4a86-b91a-6c312474b5c3'
    AND es.bounced_at IS NOT NULL
    AND es.bounce_type IN ('Permanent', 'Suppressed')
)
AND (email IS NOT NULL OR personal_email IS NOT NULL);
```

### Passo 2 — Registrar atividades de limpeza

```sql
INSERT INTO contact_activities (contact_id, activity_type, description, performed_by, metadata)
SELECT DISTINCT es.contact_id,
  'bounce_cleanup',
  'Email limpo devido a bounce permanente na campanha Follow-up 3 Advogados. Contato mantido para prospecao via LinkedIn.',
  'Sistema',
  '{"action": "email_cleared", "had_linkedin": true, "campaign": "Follow-up 3 Advogados"}'::jsonb
FROM email_sends es
JOIN contacts c ON c.id = es.contact_id
WHERE es.campaign_id = '83e206de-8946-4a86-b91a-6c312474b5c3'
  AND es.bounced_at IS NOT NULL
  AND es.bounce_type IN ('Permanent', 'Suppressed')
  AND (c.email IS NOT NULL OR c.personal_email IS NOT NULL);
```

### Resultado esperado

- ~3.172 contatos terao seus emails limpos
- Todos resetados para "Novo Lead" no CRM
- Historico de limpeza registrado na timeline de cada contato
- Nenhum contato sera deletado (todos possuem LinkedIn)
