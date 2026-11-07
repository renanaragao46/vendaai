# Projeto de Vida

Painel privado de gestão pessoal, familiar e empresarial: finanças, dívidas, operações, rotina, projetos, mapa mental e plano de execução de seis meses.

## Fonte oficial
Repositório: https://github.com/renanaragao46/vendaai  
Branch ativa: `projeto-de-vida`  
Aplicação publicada: https://projeto-de-vida-3szi.onrender.com

O produto VendaAI foi descontinuado; a base técnica foi reaproveitada. O histórico Git anterior foi preservado para rastreabilidade.

## Stack
TanStack Start, React, TypeScript, Tailwind, shadcn/ui e Supabase (Lovable Cloud). A aplicação é hospedada no Render Free e usa o banco já provisionado no projeto Lovable Projeto de Vida.

## Desenvolvimento
Requisitos: Bun, Node.js 20+ e acesso ao projeto Lovable Cloud existente.

```sh
git clone -b projeto-de-vida https://github.com/renanaragao46/vendaai.git projeto-de-vida
cd projeto-de-vida
bun install
bun run dev
```

Para execução local, use as variáveis de ambiente do backend Lovable Cloud. Nunca copie secrets para o Git. A aplicação publicada já recebe as variáveis necessárias pelo ambiente do Render.

## Banco de dados
O Supabase/Lovable Cloud do Projeto de Vida já está provisionado e contém o esquema inicial, as funções de criação/convite de household e as políticas RLS. **Não crie outro projeto Supabase e não aplique a migration inicial em um segundo banco.** O esquema-fonte está versionado em `supabase/migrations/202611070001_initial_household_workspace.sql`; a migration seguinte endurece as permissões para o household de duas pessoas.

## Privacidade
O endereço da aplicação é público, mas os dados exigem autenticação e pertencimento ao household. RLS protege as tabelas por household_id. O limite de membros é dois. Não versionar .env, tokens, service-role keys, senhas ou documentos pessoais. A branch atual remove o .env rastreado do snapshot; isso não apaga o histórico público anterior. Se algum valor privado tiver sido incluído em commits antigos, revogue/rotacione no provedor correspondente.

## Documentação
Consulte [docs/PROJECT_BLUEPRINT.md](docs/PROJECT_BLUEPRINT.md) e [docs/SETUP_SUPABASE.md](docs/SETUP_SUPABASE.md).
