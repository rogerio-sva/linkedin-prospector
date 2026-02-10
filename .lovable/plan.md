

# Retomar Disparos Pendentes da Campanha "Follow-up 3 Advogados"

## Situacao Atual

A campanha "Follow-up 3 Advogados - 09/02/2026" parou com o seguinte estado:

| Status | Quantidade |
|--------|-----------|
| Delivered | 2.252 |
| Sent (aguardando webhook) | 2.132 |
| Bounced | 1.430 |
| Failed (API key) | 5.524 |
| **Pending (nao enviados)** | **7.480** |
| Complained | 1 |

Dos 7.480 pendentes, ~808 possuem emails com historico de bounce/failed e serao automaticamente bloqueados pela protecao recém-implementada.

## Problema Tecnico

A edge function `send-campaign-emails` sempre **insere novos registros** na tabela `email_sends`. Porem, os 7.480 pendentes **ja possuem registros** nessa tabela (com `status = 'pending'`). Se reenviarmos normalmente, criaremos duplicatas.

## Plano de Implementacao

### 1. Adicionar modo "resumePending" na edge function `send-campaign-emails`

Novo parametro `resumePending: true` que muda o comportamento:
- Em vez de buscar contatos da tabela `contacts`, busca diretamente os records da `email_sends` com `status = 'pending'` para a campanha especificada
- Aplica os mesmos filtros de protecao (suppressed, undeliverable, historical fails)
- Apos enviar com sucesso: faz **UPDATE** no record existente (status, resend_id, sent_at) em vez de INSERT
- Records bloqueados pela protecao sao atualizados para `status = 'skipped'`

Arquivo: `supabase/functions/send-campaign-emails/index.ts`

### 2. Adicionar botao "Retomar Pendentes" no CampaignMetricsPanel

Quando uma campanha possui records com `status = 'pending'`, exibir um botao "Retomar Pendentes" no painel de metricas. Ao clicar:
- Abre um dialog pedindo os dados de envio (fromEmail, fromName, replyTo, emailType, emailFormat)
- Envia os pendentes em lotes de 500 (mesmo fluxo do SendCampaignDialog)
- Mostra progresso em tempo real

Arquivo: `src/components/CampaignMetricsPanel.tsx`

### 3. Detalhes da logica de resume

```text
1. Frontend envia: { campaignId, resumePending: true, fromEmail, fromName, ... }
2. Edge function busca: SELECT * FROM email_sends WHERE campaign_id = X AND status = 'pending'
3. Para cada pending record:
   a. Verifica se recipient_email esta em suppressed/undeliverable/historical fails
   b. Se bloqueado: UPDATE status = 'skipped'
   c. Se ok: envia via Resend Batch API
   d. Sucesso: UPDATE status = 'sent', resend_id = X, sent_at = now()
   e. Falha: UPDATE status = 'failed', error_message = '...'
4. Retorna contagens: { sent, failed, skipped, total }
```

### 4. Numeros esperados

- ~7.480 pending records a processar
- ~808 serao bloqueados (historico de bounce/failed) → status = 'skipped'
- ~170 serao bloqueados (lista de supressao)
- ~6.500 serao efetivamente enviados

