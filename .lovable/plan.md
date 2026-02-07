
## Plano: Mover 3 Contatos para "Em Negociação"

### Objetivo
Atualizar o estágio CRM de Alice Ruffier, Vinicius Rossi e Cassiano Beck de "Email Enviado" para "Em Negociação", registrando essa mudança no histórico de atividades.

### Contatos Identificados
| Nome | Email | ID | Estágio Atual |
|------|-------|----|----|
| Alice Ruffier | alice@vbassociados.com.br | 8b3dfa23-0049-4727-9f76-ed6924452c46 | Email Enviado |
| Cassiano Beck | cassiano.beck@letsara.com | 3ab8dd55-a1a1-46d4-a067-0e840010b527 | Email Enviado |
| Vinicius Rossi | vinicius@arrudacostaebertelli.com.br | 7d273738-d91c-4095-a8ad-8395446ac5bd | Email Enviado |

### Execução Técnica
Cada contato será atualizado via Supabase usando 3 operações paralelas:

1. **Atualizar campo `crm_stage`** na tabela `contacts`:
   - Campo: `crm_stage = "Em Negociação"`
   - Campo: `last_activity_at = [timestamp atual]`
   - Onde: `id = [contact_id]`

2. **Registrar atividade** na tabela `contact_activities`:
   - `activity_type = "stage_change"`
   - `description = "Movido para estágio: Em Negociação"`
   - Timestamp automático: `created_at`

3. **Invalidar cache** de queries relacionadas para refletir os dados atualizados na UI

### Resultado Esperado
- Os 3 contatos aparecerão na coluna "Em Negociação" do Kanban
- O timeline de cada contato mostrará a atividade "Movido para estágio: Em Negociação"
- A coluna "Email Enviado" terá 3 contatos a menos
