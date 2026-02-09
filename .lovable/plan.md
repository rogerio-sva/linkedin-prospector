

## Criar template "Follow-up 3 Advogados" com acentuacao correta

### Template final

**Assunto:** sobre o email anterior, {{firstName}}

**Corpo:**
```
Oi {{firstName}}, tudo bem?

Te enviei um email recentemente me apresentando e não sei se chegou a ver.

Sou o Thiago Vieira, da Fato Perícias. A gente trabalha com advogados que precisam de laudos técnicos sólidos pra sustentar teses no contencioso.

Atendemos bastante nas áreas de engenharia civil, segurança do trabalho, automotiva, avaliações, incêndio, análise de imagens e grafotécnica. Nosso foco é entregar laudos estruturados pro juiz entender, com metodologia clara e conclusões defensáveis.

Se fizer sentido pra você, posso te enviar um laudo modelo pra avaliar a qualidade do nosso trabalho. Sem compromisso nenhum.

Fico à disposição.

Abraço,
Thiago Vieira
Fato Perícias
(21) 3411-8738 | (21) 97110-3042
```

### Etapas tecnicas
1. Inserir novo registro em `email_templates` com nome "Follow-up 3 Advogados", subject e body acima (com acentos), variables `["firstName"]`
2. Preparar campanha para a base "Advogados Brasil" (ID: `de04814e-8ce0-4572-8bca-31df84eb8774`) usando o componente SendCampaignDialog

