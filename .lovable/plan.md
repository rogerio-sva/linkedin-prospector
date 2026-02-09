

## Mover 29 contatos para "Fechado Perdido"

### Resumo
Dos 45 emails fornecidos:
- **29 contatos** serao movidos de "Email Enviado" para "Fechado Perdido"
- **8 contatos** ja estao em "Fechado Perdido" (nenhuma acao necessaria)
- **8 emails** nao foram encontrados na base

### Emails nao encontrados
| Email |
|-------|
| tatianankotaka@gmail.com |
| viviane.abreu@yfnadvogados.com.br |
| rafaaleixo@hotmail.com |
| cristina.yoshida@aliare.com |
| dmbrazoloto@yahoo.com.br |
| gneves.geraldo@gmail.com |
| juridico01@bhayemota.com.br |

### Ja em "Fechado Perdido" (sem acao)
Ana Almeida, Clara Ulrichsen, Daniela Souza, Felipe Magalhaes, Juliana Lorigiola, Luana Baptistella, Lucas Picceli, Luisa Claussen

### Contatos a mover (29)
Aline Fujishima, Andre Ferreira, Antonio Marianno, Bernardo Abreu, Bianca Muniz, Caio Saturno, Carlos Silva, Carolina Rodrigues, Daniel Souza, Danilo Muniz, Debora Milano, Fabio Abrantes, Fernanda Penteado, Francisco Clares, Gabriela Maria, Giuliana Nascimento, Isabele Friolani, Jayme Figueiredo, Karine Fernandes, Leandro Saint'clair, Lucio Pinto, Marcela Lima, Marcus Souza, Mariane Milchereit, Patricia Reis, Rebeka Assis, Simone Pacini, Tatiany Fogaca, Vinicius Sant'anna, Wellington Ciesielski

### Execucao Tecnica
1. **UPDATE contacts** -- definir `crm_stage = 'Fechado Perdido'` e `last_activity_at = now()` para os 29 IDs
2. **INSERT contact_activities** -- registrar 29 atividades com `activity_type = 'stage_change'` e `description = 'Movido para estagio: Fechado Perdido'`
3. **Invalidar cache** das queries do CRM para refletir na UI

