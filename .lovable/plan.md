

# Plano: Enviar Campanha "Último Convite SVP 2026" para Ambas as Bases

## Template a Ser Usado

| Campo | Valor |
|-------|-------|
| **Template** | Último Convite SVP 2026 |
| **ID** | `960e4fc3-db34-4034-a684-e9018c605249` |
| **Assunto** | `{{firstName}}, começa HOJE` |
| **Remetente** | Prof. Fernando Sarian |
| **Email** | contato@academiadoperito.com |
| **Reply-To** | contato@academiadoperito.com.br |
| **Formato** | Texto puro (melhor entrega) |

## Bases de Destino

| Base | ID | Contatos Estimados |
|------|-----|-------------------|
| BASE CREA ATUAL | `238bb2e3-fabc-464f-9db4-8e4ee7648e17` | ~45.000+ |
| Engenheiros base não alunos! | `cab31c73-5cf6-452c-8fcc-0045fb1a26a9` | ~8.000+ |

## Configurações do Envio

| Configuração | Valor |
|--------------|-------|
| **Ignorar já enviados** | Sim (evita duplicatas) |
| **Tipo de email** | Ambos (prioridade pessoal) |
| **Proteção CRM** | Ativa (exclui contatos em negociação) |
| **Bloquear suprimidos** | Sim (bounces e reclamações) |
| **Bloquear inválidos** | Sim (emails undeliverable) |

## Processo de Envio

1. **Primeira Chamada**: Enviar para BASE CREA ATUAL
   - Frontend divide em lotes de 500 contatos
   - Backend processa em sub-lotes de 100 via Resend Batch API
   - Delay de 50ms entre chamadas

2. **Segunda Chamada**: Enviar para Engenheiros base não alunos!
   - Mesmo processo de batching
   - Contatos que existem em ambas as bases recebem apenas 1 email

## Resultado Esperado

- Emails personalizados com "{{firstName}}, começa HOJE" como assunto
- Corpo do email começando com "[Nome], é hoje."
- Tracking de entregas, aberturas e cliques na tabela `email_sends`
- Contatos problemáticos automaticamente filtrados

## Tempo Estimado

Com o Resend Batch API (100 emails por request):
- ~45.000 emails = ~8-10 minutos
- ~8.000 emails = ~2-3 minutos

