

# Plano: Remover E-mails das Bases de Engenheiros

## E-mails a Remover (12 contatos)

| # | E-mail |
|---|--------|
| 1 | lucia.alves.adv@gmail.com |
| 2 | delma.avelino@gmail.com |
| 3 | sjesusjj@gmail.com |
| 4 | walterquaglio@gmail.com |
| 5 | ronaldo.ligeiro@fda.com.br |
| 6 | warleyjsoaressilva@gmail.com |
| 7 | francielle.feitosa.dias.santos@gmail.com |
| 8 | silabas270974@gmail.com |
| 9 | eng1@emsamed.com.br |
| 10 | mariajose_sf@yahoo.com |
| 11 | luizcattetecontador@gmail.com |
| 12 | maria_do_socorro.fono@yahoo.com.br |

## Bases Alvo

| Base | ID |
|------|-----|
| BASE CREA ATUAL | `238bb2e3-fabc-464f-9db4-8e4ee7648e17` |
| Engenheiros base não alunos! | `cab31c73-5cf6-452c-8fcc-0045fb1a26a9` |

## Etapas

### 1. Preview (Dry Run) - Opcional
Primeiro, fazer um dry run para ver quantos contatos serão encontrados em cada base.

### 2. Executar Remoção
Chamar a Edge Function `remove-contacts-by-email` duas vezes (uma para cada base):

**Chamada 1 - BASE CREA ATUAL:**
```json
{
  "targetBaseId": "238bb2e3-fabc-464f-9db4-8e4ee7648e17",
  "emails": ["lucia.alves.adv@gmail.com", "delma.avelino@gmail.com", ...],
  "dryRun": false,
  "alsoMatchPersonalEmail": true
}
```

**Chamada 2 - Engenheiros base não alunos!:**
```json
{
  "targetBaseId": "cab31c73-5cf6-452c-8fcc-0045fb1a26a9",
  "emails": ["lucia.alves.adv@gmail.com", "delma.avelino@gmail.com", ...],
  "dryRun": false,
  "alsoMatchPersonalEmail": true
}
```

## O que a função faz

1. Normaliza os e-mails (lowercase, trim)
2. Busca contatos que tenham esses e-mails (corporativo OU pessoal)
3. Remove as tags associadas (`contact_tags`)
4. Deleta os contatos da base

## Resultado Esperado

- Contatos com esses e-mails serão removidos de ambas as bases
- A função retorna quantos foram encontrados e quantos foram deletados
- E-mails não encontrados são listados para referência

