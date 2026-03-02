

# Criar Template e Enviar Teste

## 1. Inserir template no banco

Inserir na tabela `email_templates`:

- **Nome:** Gestores Sinistro - Pergunta Consultiva
- **Assunto:** `o que fazem quando o laudo volta fraco, {{firstName}}?`
- **Corpo:**
```text
Oi {{firstName}},

Me tira uma dúvida: quando vocês recebem um laudo técnico de sinistro e ele volta inconclusivo ou mal fundamentado, qual o impacto real na operação? Vocês conseguem resolver internamente ou precisa refazer tudo?

Pergunto porque a gente atende várias seguradoras e reguladoras, e o que mais ouvimos é que laudo fraco gera retrabalho, atrasa a regulação e às vezes até compromete a decisão de indenização.

Nosso trabalho é justamente entregar laudos que não voltam: metodologia rastreável, conclusão objetiva e fundamentação técnica que sustenta a decisão.

Se quiser, posso te enviar um modelo de laudo nosso pra você comparar com o que recebem hoje. Sem compromisso nenhum — é só pra você avaliar o padrão.

Abraço,
Thiago Vieira
Fato Perícias
(21) 3411-8738 | (21) 97110-3042
```
- **Variáveis:** `["firstName"]`

## 2. Enviar teste

Disparar via edge function `send-campaign-emails` um e-mail de teste para `rogerio.sva@gmail.com` com `firstName: "Rogério"`, usando `fromEmail: contato@fatopericias.com.br` e `fromName: Thiago Vieira | Fato Perícias`.

## Detalhes técnicos
- INSERT via migration tool na tabela `email_templates`
- Chamada à edge function `send-campaign-emails` com payload de teste (testContact + emailFormat: text)
- Nenhuma alteração de código

