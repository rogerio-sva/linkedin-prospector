
# Corrigir Lógica de Protecao Anti-Bounce

## Problema Identificado

A protecao anti-bounce no `send-campaign-emails` bloqueia destinatarios que possuem historico de `failed` em **qualquer campanha**, mesmo quando a falha foi causada por erro de configuracao (ex: "API key is invalid", "API key unauthorized for domain"). Esses nao sao problemas do destinatario e nao deveriam impedir reenvios.

Resultado: 6.141 emails foram marcados como `skipped` desnecessariamente na remediacao da campanha Follow-up 3 Advogados.

## Solucao

Alterar a logica de protecao anti-bounce para **ignorar falhas tecnicas** que nao sao culpa do destinatario.

### Falhas a ignorar (falsos positivos):

- `"API key is invalid"` - erro de configuracao de chave
- `"API key unauthorized for domain"` - dominio nao autorizado na chave
- `"rate limit"` - ja ignorado atualmente
- `"Too many requests"` - variacao do rate limit

### Arquivo a alterar

`supabase/functions/send-campaign-emails/index.ts`, linhas 680-699

### Mudanca especifica

Na secao `resumePending`, onde se filtra o `historicalFailSet`, a logica atual so ignora `rate limit`. Expandir para ignorar todas as falhas tecnicas/configuracao:

```typescript
if (failedHistory) {
  for (const record of failedHistory) {
    // Skip technical/configuration errors - not recipient's fault
    if (record.status === "failed" && record.error_message) {
      const msg = record.error_message.toLowerCase();
      if (
        msg.includes("rate limit") ||
        msg.includes("too many requests") ||
        msg.includes("api key is invalid") ||
        msg.includes("api key unauthorized") ||
        msg.includes("unauthorized for domain")
      ) {
        continue;
      }
    }
    historicalFailSet.add(record.recipient_email.toLowerCase());
  }
}
```

### Mesma correcao no fluxo normal (nao-resume)

Verificar se a mesma logica de protecao existe no fluxo normal de envio (nao `resumePending`) e aplicar a mesma correcao la tambem, para consistencia.

### Apos o deploy

Resetar os 6.141 registros `skipped` desta campanha para `pending` e reprocessar:

```sql
UPDATE email_sends
SET status = 'pending', error_message = NULL
WHERE campaign_id = '83e206de-8946-4a86-b91a-6c312474b5c3'
  AND status = 'skipped'
  AND error_message = 'Bloqueado por proteção anti-bounce';
```

## Detalhes tecnicos

- Arquivo: `supabase/functions/send-campaign-emails/index.ts`
- Linhas afetadas: ~690-699 (bloco `resumePending`) e potencialmente o fluxo normal de envio
- A Edge Function sera reimplantada automaticamente apos a alteracao
- O reset dos 6.141 registros sera feito via ferramenta de migracao SQL
