# Configuração privada do Projeto de Vida

## 1. Criar o banco isolado
Crie um projeto novo no Supabase (plano Free). Não conecte nem reutilize o banco antigo do VendaAI.

## 2. Aplicar a estrutura
No Supabase, abra SQL Editor e execute integralmente:
`supabase/migrations/202611070001_initial_household_workspace.sql`

## 3. Criar os dois usuários
Em Authentication → Users, convide/crie apenas os dois e-mails autorizados. Desative o cadastro público (Authentication → Providers / Signups, conforme a interface atual). Use senha forte e MFA quando disponível.

## 4. Criar o espaço compartilhado
Depois de criar os usuários, copie os UUIDs exibidos na lista de usuários e execute no SQL Editor, substituindo os marcadores:
```sql
insert into public.workspaces (id, name)
values ('COLOQUE-UM-UUID-NOVO-AQUI', 'Projeto de Vida');

insert into public.workspace_members (workspace_id, user_id, role)
values
('UUID-DO-WORKSPACE', 'UUID-DO-USUARIO-1', 'owner'),
('UUID-DO-WORKSPACE', 'UUID-DO-USUARIO-2', 'member');
```
O banco usa RLS: consultas e alterações nas tabelas operacionais só são permitidas a membros do workspace.

## 5. Variáveis de ambiente
No provedor de hospedagem, configure:
- `VITE_SUPABASE_URL`: Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable/anon key

Nunca use `service_role`, secret key, senha de banco ou token privado no frontend, GitHub ou em mensagens.

## 6. Privacidade
O link do site não é segredo. A proteção vem do login e das políticas RLS do banco. Não armazenar documentos pessoais desnecessários. Fazer backup periódico pelo Supabase.
