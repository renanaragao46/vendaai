# Backend privado — Projeto de Vida

## Estado atual
O projeto Supabase do Projeto de Vida já está provisionado dentro do Lovable Cloud e foi inspecionado. O banco já contém as tabelas de households, membros/convites, contas, transações, dívidas, orçamentos, patrimônio, mapa mental, tarefas, Uber/99, bebidas, e-commerce, fases de seis meses, notas, decisões, reuniões, biblioteca e regras.

**Não crie outro projeto Supabase. Não reutilize o backend do VendaAI. Não execute uma migration inicial em outro banco.**

## Estrutura e segurança
- Fonte do esquema: `supabase/migrations/202611070001_initial_household_workspace.sql`.
- Endurecimento RLS: `supabase/migrations/202611070002_household_security.sql`.
- Funções existentes: `create_household(text,text)`, `accept_my_invites()`, `is_household_member(uuid)` e `create_household_invite(text)`.
- RLS protege cada linha pelo household_id.
- O household aceita no máximo duas pessoas.
- Apenas owner administra o household e cria convites.
- Usuários convidados aceitam o vínculo pelo e-mail autenticado.
- Nenhuma chave service_role é usada no frontend.

## Configuração da aplicação
A aplicação hospedada no Render já recebeu as variáveis públicas do backend Lovable Cloud:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Essas chaves são configuradas no ambiente do provedor e não devem ser adicionadas ao repositório. A chave publishable/anon é própria para uso no cliente; nunca use service_role/secret key.

## Primeiro acesso
1. Acesse a aplicação publicada.
2. Crie sua conta com e-mail e senha.
3. No primeiro acesso, o sistema chama `create_household` e inicializa categorias, contas, dívida a confirmar, orçamento inicial, mapa mental, rotina, plano de seis meses, regras e biblioteca.
4. Em Configurações, o owner cria um convite para o e-mail da segunda pessoa.
5. A segunda pessoa cria sua conta usando exatamente o e-mail convidado; o sistema aceita o convite no onboarding.
6. Somente as duas contas vinculadas ao household podem acessar os registros.

O cadastro de uma conta, por si só, não concede acesso aos dados. O acesso depende de membership e RLS.

## Operação local
Para rodar localmente, configure as variáveis acima no arquivo `.env.local` usando os valores do Lovable Cloud. Nunca faça commit desse arquivo.
