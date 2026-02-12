
# Correcao: Filtro de estagio CRM nos disparos de campanha

## Problema identificado

A contato **Bruna Amaral** (`bruna@glmadv.com.br`) foi movida para **"Em Negociacao"** em 16/01/2026, mas recebeu email da campanha Follow-up 3 em 10/02/2026.

**Causa raiz**: O frontend (`SendCampaignDialog`) filtra corretamente por estagio CRM (so permite "Novo Lead" e "Email Enviado"), porem as funcoes backend nao aplicam esse mesmo filtro:

1. **`resume-campaign`**: Busca todos os contatos da base com email, sem verificar estagio CRM
2. **`send-campaign-emails`**: Recebe `contactIds` e processa sem re-verificar o estagio

## Correcao proposta

### 1. Corrigir `resume-campaign/index.ts`

Adicionar filtro de estagio CRM na query de busca de contatos (linha ~169):

```text
ANTES:
.or("email.not.is.null,personal_email.not.is.null")

DEPOIS:
.or("email.not.is.null,personal_email.not.is.null")
.or("crm_stage.is.null,crm_stage.eq.,crm_stage.in.(Novo Lead,Email Enviado)")
```

Isso garante que contatos em estagios avancados (Prospecao, Em Negociacao, Proposta Enviada, Fechado Ganho, Fechado Perdido) sejam excluidos automaticamente durante a retomada de campanhas.

### 2. Corrigir `send-campaign-emails/index.ts`

Adicionar verificacao de estagio CRM ao processar `contactIds` recebidos. Antes de enviar, buscar o `crm_stage` de cada contato e pular os que estiverem em estagios avancados.

Especificamente, na logica que carrega os contatos pelo `contactIds`, adicionar a coluna `crm_stage` na query e filtrar apenas os permitidos ("Novo Lead", "Email Enviado", null ou vazio).

### 3. Definir constante compartilhada

Criar uma lista de estagios permitidos para envio em ambas as funcoes:

```typescript
const SENDABLE_STAGES = ["Novo Lead", "Email Enviado"];
```

## Secao tecnica

### Arquivos modificados

- `supabase/functions/resume-campaign/index.ts` - Adicionar filtro `.or(crm_stage...)` na query de contatos
- `supabase/functions/send-campaign-emails/index.ts` - Adicionar verificacao de `crm_stage` ao processar contactIds recebidos

### Impacto

- Nenhuma campanha futura enviara emails para contatos em estagios avancados do CRM
- A correcao atua tanto no disparo inicial quanto na retomada (resume)
- Contatos movidos manualmente para estagios avancados ficam protegidos contra disparos automaticos
