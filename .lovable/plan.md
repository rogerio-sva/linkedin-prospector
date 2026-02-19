

# Trocar APIFY_API_TOKEN

## O que sera feito
Atualizar o secret `APIFY_API_TOKEN` com uma nova chave de API do Apify.

## Passos
1. Solicitar a nova chave via ferramenta de secrets (o campo aparecera no chat para voce colar a nova chave)
2. O valor antigo sera substituido automaticamente
3. Todas as edge functions que usam esse token (`search-leads`, `fetch-dataset`, `resurrect-run`, `suggest-jobs`) passarao a usar a nova chave imediatamente

## Onde encontrar sua chave Apify
- Acesse [console.apify.com](https://console.apify.com)
- Va em **Settings** > **Integrations** > **API Token**
- Copie o token

