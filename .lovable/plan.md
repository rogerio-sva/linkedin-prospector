

# Exportar Todos os Dados do Projeto

## O que será exportado

Todas as 14 tabelas do banco de dados:

| Tabela | Descrição |
|--------|-----------|
| contacts | Todos os leads/contatos |
| bases | Bases de contatos |
| contact_tags | Relação contato-tag |
| tags | Tags cadastradas |
| email_templates | Templates de e-mail |
| email_campaigns | Campanhas |
| email_sends | Envios individuais |
| email_validations | Validações de e-mail |
| suppressed_emails | Lista de supressão |
| contact_activities | Atividades CRM |
| crm_stages | Estágios do funil |
| team_members | Membros da equipe |
| cleanup_jobs | Jobs de limpeza |
| search_runs | Buscas realizadas |

## Abordagem

Criar uma página `/export` com um botão que busca todas as tabelas via SDK e gera um arquivo JSON único com todos os dados, além de opção de baixar cada tabela individualmente em CSV.

**Atenção:** tabelas grandes (contacts, email_sends, suppressed_emails) podem ter mais de 1000 registros. O código fará paginação automática para garantir que nenhum dado fique de fora.

## Implementação

1. Criar página `ExportAllDataPage.tsx` com botões de exportação
2. Criar utilitário de paginação para buscar todos os registros além do limite de 1000
3. Adicionar rota `/export` no App.tsx
4. Gerar JSON completo ou CSVs individuais por tabela

