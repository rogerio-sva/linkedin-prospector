

# Plano: Atualizar Template e Enviar Teste

## Corpo do E-mail Corrigido

O usuário forneceu o texto correto:

```
{{firstName}}, é hoje.

A Semana Vivendo de Perícias começa daqui a pouco e essa é a última chance de entrar.

Se você é engenheiro e quer entender como atuar como perito judicial, usar sua experiência técnica pra gerar uma renda extra (ou até mudar de carreira), essa semana foi feita pra você.

São aulas práticas, sem enrolação.

Se quiser participar, se inscreve aqui agora: https://link.academiadoperito.com.br/oi

Nos vemos lá, 
Prof. Fernando Sarian
```

## Etapas

### 1. Atualizar o Template no Banco

Atualizar o registro do template `Último Convite SVP 2026` (ID: `960e4fc3-db34-4034-a684-e9018c605249`) com o novo corpo.

### 2. Enviar E-mail de Teste

Chamar a Edge Function `send-campaign-emails` com:

| Parâmetro | Valor |
|-----------|-------|
| `templateId` | `960e4fc3-db34-4034-a684-e9018c605249` |
| `fromEmail` | `contato@academiadoperito.com` |
| `fromName` | `Prof. Fernando Sarian` |
| `replyTo` | `contato@academiadoperito.com.br` |
| `emailFormat` | `text` |
| `testRecipient` | `{ email: "rogerio.sva@gmail.com", name: "Rogério" }` |

## Resultado Esperado

E-mail recebido em `rogerio.sva@gmail.com`:
- **De**: Prof. Fernando Sarian <contato@academiadoperito.com>
- **Assunto**: Rogério, começa HOJE
- **Corpo**: Texto personalizado iniciando com "Rogério, é hoje."

