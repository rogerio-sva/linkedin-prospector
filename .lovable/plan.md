
# Limpeza Completa de Bounces e Proteção Anti-Reenvio

## Resumo da Situacao

- **292 contatos** ainda possuem emails que estao na lista de supressao (todos com LinkedIn)
- **38.502 envios** falharam por "API key invalida" — nao sairam de fato, mas os destinatarios nao devem ser reenviados sem validacao
- A lista de supressao ja tem **10.916 emails** registrados

## Plano em 2 Etapas

### Etapa 1: Limpar os 292 contatos pendentes

Executar o `execute-bounce-cleanup` que ja existe. Ele vai:
- Encontrar os 292 contatos via a funcao SQL `find_contacts_with_bounced_emails`
- Como todos tem LinkedIn: limpar os campos `email` e `personal_email`, resetar `crm_stage` para "Novo Lead"
- Registrar atividade no historico de cada contato

Nenhuma alteracao de codigo necessaria — basta chamar a funcao existente.

### Etapa 2: Implementar protecao pre-envio anti-failed/bounce

Modificar a edge function `send-campaign-emails` para bloquear automaticamente qualquer destinatario que tenha historico de:
- `status = 'bounced'` (qualquer tipo)
- `status = 'failed'` (exceto falhas de rate limit, que sao transitorias)

Isso impede que os 38.502 enderecos que falharam por API key sejam incluidos em campanhas futuras.

---

## Detalhes Tecnicos

### Etapa 1 — Execucao manual do cleanup

Chamar a edge function `execute-bounce-cleanup` via curl. Sem alteracoes de codigo.

### Etapa 2 — Alteracao na `send-campaign-emails`

No trecho onde a lista de destinatarios e montada (apos filtrar suprimidos e invalidados), adicionar uma consulta a `email_sends` para buscar emails distintos com `status IN ('bounced', 'failed')` e `error_message NOT LIKE '%rate limit%'`. Esses emails serao removidos da lista de envio.

Arquivo modificado:
- `supabase/functions/send-campaign-emails/index.ts`

Tambem atualizar o `SendCampaignDialog.tsx` para exibir ao usuario a contagem de emails bloqueados por historico de falha, junto com as outras metricas ja exibidas (suprimidos, invalidados).

Arquivos modificados:
- `src/components/SendCampaignDialog.tsx`
