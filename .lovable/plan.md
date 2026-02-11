
# Agendar Envio dos 6.141 Pendentes para Amanha 8h30 BRT

## O que sera feito

Criar uma Edge Function dedicada (`scheduled-resume`) que faz o trabalho que o frontend faria: busca todos os IDs pendentes da campanha e chama a `send-campaign-emails` em lotes de 500, tudo server-side. Depois, agendar via pg_cron para executar amanha as 11:30 UTC (8:30 BRT).

## Etapas

### 1. Criar Edge Function `scheduled-resume`

Uma funcao que recebe `campaignId`, `fromEmail`, `fromName`, `replyTo`, `emailFormat` e:
- Busca todos os `email_sends` com `status = 'pending'` para a campanha
- Divide em lotes de 500 IDs
- Chama `send-campaign-emails` com `resumePending: true` para cada lote sequencialmente
- Usa `EdgeRuntime.waitUntil()` para processar em background

### 2. Agendar com pg_cron

Criar um job unico via SQL que dispara amanha (2026-02-12) as 11:30 UTC:
- Usa `pg_net` para fazer HTTP POST na Edge Function `scheduled-resume`
- Passa os parametros da campanha (`83e206de-...`, `fatopericias.com.br`, etc.)
- Job executa uma unica vez e pode ser removido depois

### 3. Parametros do envio

- **Campanha:** `83e206de-8946-4a86-b91a-6c312474b5c3`
- **Remetente:** dominio `fatopericias.com.br` (mesmo usado nos envios anteriores)
- **Formato:** texto puro (melhor entrega)
- **Pendentes:** 6.141 emails

## Secao tecnica

- **Arquivo novo:** `supabase/functions/scheduled-resume/index.ts`
- **SQL (via insert, nao migracao):** `cron.schedule()` com `pg_net.http_post()` para 2026-02-12 11:30 UTC
- O cron sera configurado para rodar no minuto especifico e depois auto-removido (ou removido manualmente)
- A Edge Function `scheduled-resume` chamara internamente a `send-campaign-emails` via HTTP fetch em lotes
- Sera necessario confirmar o email e nome exatos do remetente antes de agendar
