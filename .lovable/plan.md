

# Criar Template para Gerentes de Frota

## Template proposto

- **Nome:** Gerentes de Frota - Pergunta Consultiva
- **Assunto:** `como vocês lidam com sinistros de frota, {{firstName}}?`
- **Corpo:**
```text
Oi {{firstName}},

Me tira uma dúvida: quando acontece um sinistro na frota de vocês — colisão, roubo recuperado, dano por terceiro — como funciona o processo de perícia? Vocês dependem só do laudo da seguradora ou contratam assistência técnica própria?

Pergunto porque a gente atende várias empresas com frota e o que mais ouvimos é que o laudo da seguradora nem sempre reflete o prejuízo real, e a empresa acaba aceitando uma indenização abaixo do que deveria.

Nosso trabalho é justamente fazer a perícia do lado da empresa: avaliar o dano com metodologia própria, fundamentar tecnicamente e garantir que a indenização seja justa.

Se quiser, posso te enviar um caso real nosso de perícia em frota pra você ver como funciona. Sem compromisso.

Abraço,
Thiago Vieira
Fato Perícias
```
- **Variáveis:** `["firstName"]`

## Ações

1. Inserir o template na tabela `email_templates` via ferramenta de inserção de dados
2. Enviar e-mail de teste para `rogerio.sva@gmail.com` com `firstName: "Rogério"`, remetente `contato@fatopericias.com.br` / `Thiago Vieira | Fato Perícias`, sem telefones na assinatura

## Detalhes técnicos
- INSERT na tabela `email_templates` (ferramenta de dados, não migration)
- Chamada à edge function `send-campaign-emails` com payload de teste (testRecipient/testSubject/testBody)
- Nenhuma alteração de código
