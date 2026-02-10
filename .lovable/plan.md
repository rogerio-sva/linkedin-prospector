

# Sincronizar Status + Capturar Emails Suprimidos do Resend

## Problema

O sistema atual de sincronizacao (`sync-email-status`) consulta o Resend para atualizar status dos emails, mas **ignora o status "suppressed"**. Emails suprimidos pelo Resend ficam como "sent" no nosso banco, e continuamos tentando enviar pra eles em campanhas futuras.

O Resend nao tem uma API para baixar a lista completa de suprimidos -- mas quando consultamos email por email, ele retorna `last_event: "suppressed"`. Precisamos capturar isso.

## Solucao

### 1. Atualizar a Edge Function `sync-email-status`

Adicionar tratamento para dois novos status:

- **`suppressed`**: Email suprimido pelo Resend (bounce/complaint anterior). Acao: marcar como `bounced` no nosso banco + adicionar a `suppressed_emails` + registrar atividade no CRM.
- **`delivery-delayed`**: Email com entrega atrasada. Acao: apenas registrar o atraso, sem bloquear.

Trecho a adicionar no mapeamento de status (apos o bloco de `complained`):

```text
if lastEvent === "suppressed":
  - Atualizar email_sends.status = "bounced"
  - Atualizar bounced_at, bounce_type = "Suppressed", bounce_message
  - Inserir na suppressed_emails (reason: "resend_suppression")
  - Registrar contact_activity (activity_type: "email_suppressed")
  - Incrementar result.bounced
```

### 2. Executar a sincronizacao da campanha Follow-up 3

Apos atualizar a funcao, rodar o sync para a campanha ativa, processando os ~6.000+ emails com status `sent` que ainda nao receberam webhook. Isso vai:
- Atualizar entregas reais (delivered, opened, clicked)
- Detectar bounces nao capturados por webhook
- **Capturar emails suprimidos** e adiciona-los a nossa lista local
- Gerar numeros finais reais da campanha

Como o limite padrao e 500, serao necessarias multiplas execucoes (ou aumentar o limite).

### 3. Resultado esperado

Apos a sincronizacao:
- Todos os emails suprimidos pelo Resend serao adicionados a `suppressed_emails`
- Campanhas futuras nao enviarao mais pra esses enderecos (ja temos essa protecao pre-envio)
- O CRM registrara a supressao no timeline do contato
- Os numeros da campanha refletirao a realidade (delivered vs suppressed vs bounced)

## Detalhes tecnicos

**Arquivo modificado:** `supabase/functions/sync-email-status/index.ts`

**Novo bloco de codigo** a ser inserido apos a linha 161 (apos o tratamento de `complained`):

- Condicao: `lastEvent === "suppressed"`
- Updates em `email_sends`: status = "bounced", bounce_type = "Suppressed"
- Upsert em `suppressed_emails` com reason = "resend_suppression"
- Insert em `contact_activities` com activity_type = "email_suppressed"
- Contador: `result.bounced++`

Tambem sera adicionado um novo campo `suppressed` ao `EmailStatusResult` para diferenciar nos relatorios.

**Nenhuma alteracao de banco de dados** necessaria -- as tabelas `suppressed_emails` e `contact_activities` ja suportam os dados.
