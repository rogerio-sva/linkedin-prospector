

# Plano: Continuar Envio da Campanha "Último Convite SVP 2026"

## Status Atual

| Métrica | Valor |
|---------|-------|
| **Emails já enviados** | 800 |
| **Entregues** | 549 |
| **Aguardando confirmação** | 247 |
| **Base processada** | Engenheiros base não alunos! (parcial) |
| **BASE CREA ATUAL** | Não iniciada |

## Problema Identificado

O envio anterior falhou porque a função estava usando o modo "legacy" que tenta carregar todos os contatos de uma vez usando `range(offset, offset + pageSize)`. Com offsets muito grandes (31.000+), o banco de dados está sofrendo **statement timeout**.

## Solução: Usar batchMode com contactIds

O sistema suporta um modo de batch mais eficiente (`batchMode: true`) que:
1. Recebe IDs específicos de contatos para processar
2. Busca contatos em sub-lotes de 50 IDs (sem offset problemático)
3. Envia emails em lotes de 100 via Resend Batch API

## Processo de Retomada

### 1. Buscar IDs de contatos a enviar (excluindo já enviados)
```sql
-- Para cada base, buscar contatos que NÃO têm email_send para esta campanha
SELECT c.id FROM contacts c
WHERE c.base_id = '<base_id>'
AND NOT EXISTS (
  SELECT 1 FROM email_sends es 
  WHERE es.contact_id = c.id 
  AND es.campaign_id = '<campaign_id>'
)
```

### 2. Dividir em lotes e chamar a edge function
- Dividir IDs em lotes de 500
- Chamar `/send-campaign-emails` com `batchMode: true` e `contactIds: [...]`
- Fazer chamadas sequenciais (uma por vez) para evitar sobrecarga

### 3. Bases a processar

| Base | Total | Já Enviados | Restantes |
|------|-------|-------------|-----------|
| Engenheiros base não alunos! | ~23.903 | ~800 | ~23.000 |
| BASE CREA ATUAL | ~45.097 | 0 | ~45.000 |

## Configurações do Envio

| Configuração | Valor |
|--------------|-------|
| **Template ID** | `960e4fc3-db34-4034-a684-e9018c605249` |
| **Campaign ID** | `3e4ec26c-868b-4884-8363-6ba586626416` (reusa existente) |
| **Remetente** | Prof. Fernando Sarian |
| **Email** | contato@academiadoperito.com |
| **Reply-To** | contato@academiadoperito.com.br |
| **Formato** | Texto puro |
| **batchMode** | true |

## Tempo Estimado

- ~23.000 emails (Engenheiros restantes): ~5-7 minutos
- ~45.000 emails (BASE CREA): ~10-15 minutos
- **Total**: ~15-22 minutos

## Detalhes Técnicos

O envio será feito chamando a edge function `/send-campaign-emails` com:
```json
{
  "templateId": "960e4fc3-db34-4034-a684-e9018c605249",
  "baseId": "<base_id>",
  "campaignId": "3e4ec26c-868b-4884-8363-6ba586626416",
  "fromEmail": "contato@academiadoperito.com",
  "fromName": "Prof. Fernando Sarian",
  "replyTo": "contato@academiadoperito.com.br",
  "emailType": "both",
  "emailFormat": "text",
  "batchMode": true,
  "contactIds": ["id1", "id2", ...]
}
```

Cada lote de 500 contactIds será processado sequencialmente, com o backend dividindo em sub-lotes de 50 para busca e 100 para envio.

