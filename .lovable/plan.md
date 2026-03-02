

# Criar Template "Follow-up Advogados - Consultivo + LinkedIn"

## Objetivo
Inserir o template de follow-up na tabela `email_templates` com a copy original aprovada, agora com acentuação correta.

## Copy final do template

**Nome:** Follow-up Advogados - Consultivo + LinkedIn

**Assunto:** `uma pergunta rápida, {{firstName}}`

**Corpo:**
```text
Oi {{firstName}},

Uma dúvida sincera: nas ações que envolvem perícia técnica, você costuma indicar assistente técnico ou deixa só com o perito do juízo?

Pergunto porque muitos advogados que a gente atende descobriram que ter um assistente técnico bem preparado muda completamente o rumo da prova. E, em alguns casos, o parecer do assistente acaba sendo mais decisivo que o laudo do perito judicial.

Se quiser trocar uma ideia sobre isso, estou à disposição. Sem compromisso.

Ah, encontrei seu contato pelo LinkedIn e achei que podia fazer sentido pra sua atuação.

Abraço,
Thiago Vieira
Fato Perícias
(21) 3411-8738 | (21) 97110-3042
```

## Implementação
- Um `INSERT` na tabela `email_templates` com nome, assunto, corpo (todos acentuados corretamente) e variáveis `["firstName"]`
- Nenhuma alteração de código necessária

