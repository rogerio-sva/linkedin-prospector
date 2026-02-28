

# Exportar Lista de E-mails Suprimidos e Bounced

## Objetivo
Adicionar um botao na interface para baixar um arquivo CSV/XLSX com todos os e-mails da tabela `suppressed_emails`, permitindo usar essa lista em outras aplicacoes para identificar e-mails invalidos.

## O que sera exportado
- Email
- Motivo (reason)
- Tipo de bounce (bounce_type)
- Erro original (original_error)
- Data de criacao (created_at)

## Implementacao

### 1. Criar componente ExportSuppressedEmails
- Botao na pagina de Campanhas (CampaignsPage), proximo ao painel de bounce cleanup
- Ao clicar, busca todos os registros da tabela `suppressed_emails`
- Gera arquivo XLSX usando a biblioteca `xlsx` (ja instalada no projeto)
- Download automatico no navegador

### 2. Detalhes tecnicos
- Consulta paginada a `suppressed_emails` para contornar o limite de 1000 registros por query
- Reutiliza o padrao de exportacao ja existente em `src/lib/exportUtils.ts`
- Opcao de exportar como XLSX (compativel com Excel e facil de importar em outras ferramentas)

### 3. Localizacao na interface
- Botao "Exportar Suprimidos" na pagina de Campanhas, junto aos controles de bounce cleanup existentes

