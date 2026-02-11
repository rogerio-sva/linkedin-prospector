

# Enviar os 6.141 Pendentes Imediatamente

## O que sera feito

Disparar a Edge Function `scheduled-resume` agora mesmo, manualmente, para iniciar o envio dos 6.141 emails pendentes da campanha "Follow-up 3 Advogados". Alem disso, remover o cron job agendado para amanha, ja que nao sera mais necessario.

## Etapas

### 1. Chamar a Edge Function `scheduled-resume` agora

Fazer um POST direto na funcao com os mesmos parametros que estavam configurados no cron:
- **campaignId:** `83e206de-8946-4a86-b91a-6c312474b5c3`
- **fromEmail:** `contato@fatopericias.com.br`
- **fromName:** `Thiago Vieira`
- **replyTo:** `contato@fatopericias.com.br`
- **emailFormat:** `text`

A funcao vai buscar todos os pendentes e processar em lotes de 500 em background.

### 2. Remover o cron job de amanha

Executar SQL para desagendar o job `scheduled-resume-followup3`, ja que o envio sera feito agora.

```sql
select cron.unschedule('scheduled-resume-followup3');
```

### 3. Monitorar

Acompanhar os logs da Edge Function para confirmar que os lotes estao sendo processados.

## Secao tecnica

- Nenhum arquivo novo ou alteracao de codigo necessaria
- A Edge Function `scheduled-resume` ja esta deployada e pronta
- O processamento usa `EdgeRuntime.waitUntil()` para rodar em background
- Serao ~13 lotes de 500 emails cada, com 2 segundos de intervalo entre lotes

