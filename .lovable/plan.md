

## Plano: Reenvio dos emails falhados + Limpeza

### 1. Remover o cron job de sync automático
O cron `sync-email-status-auto` será removido via SQL, pois a sincronização já foi concluída (apenas 4 emails restantes).

### 2. Reenviar os ~5.682 emails elegíveis
Disparar os emails para os contatos que falharam por API key inválida (5.523) e os que nunca foram enviados (159), utilizando o fluxo existente de campanha.

**Critérios de exclusão automática:**
- Contatos que já receberam (status `delivered`, `sent`, `opened`, `clicked`) nesta campanha
- Emails na tabela `suppressed_emails`
- Emails com histórico de `bounced` em qualquer campanha
- Contatos com histórico de `failed` que NÃO foram causados por erro de API key (proteção existente)

**Estratégia técnica:**
- Buscar os `contact_ids` elegíveis via query SQL
- Marcar os registros `failed` (por API key) existentes como `skipped` para não conflitar
- Usar o `send-campaign-emails` em modo `batchMode` com os IDs específicos
- Processar em lotes de 500 pelo frontend (SendCampaignDialog / CampaignMetricsPanel)
- Domínio `fatopericias.com.br` utilizará `RESEND_API_KEY_2` automaticamente (já implementado)

### 3. Detalhes de implementação

**Passo 1 - SQL:** Remover cron job
```sql
SELECT cron.unschedule('sync-email-status-auto');
```

**Passo 2 - SQL:** Atualizar os 5.524 `failed` para `pending` (permitindo reprocessamento)
```sql
UPDATE email_sends
SET status = 'pending', error_message = NULL, updated_at = now()
WHERE campaign_id = '83e206de-8946-4a86-b91a-6c312474b5c3'
  AND status = 'failed'
  AND error_message LIKE '%API key is invalid%'
  AND recipient_email NOT IN (SELECT email FROM suppressed_emails);
```

**Passo 3:** Usar a funcionalidade de "Retomar Campanha" existente (resume-campaign) para processar os pendentes. O sistema já:
- Processa em lotes de 500
- Usa a API key correta por domínio
- Exclui suprimidos automaticamente
- Registra resultados via UPDATE (sem duplicatas)

**Passo 4:** Para os 159 nunca enviados, criar novos registros `pending` na `email_sends` e incluí-los no mesmo fluxo de retomada.

### Resultado esperado
- ~5.682 emails reenviados com a API key correta
- Zero reenvios para quem já recebeu, suprimidos ou bounces
- Cron de sync removido
