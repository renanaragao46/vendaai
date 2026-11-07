# Projeto de Vida

Painel privado de gestão pessoal, familiar e empresarial: finanças, dívidas, operações, rotina, projetos, mapa mental e plano de execução de seis meses.

## Fonte oficial
Este repositório é a fonte de verdade do código. O produto VendaAI foi descontinuado; a base técnica está sendo reaproveitada para o Projeto de Vida. O histórico Git anterior é preservado para rastreabilidade.

## Stack existente
TanStack Start, React, TypeScript, Tailwind, shadcn/ui, Supabase e CI. A arquitetura será auditada e adaptada gradualmente; componentes e serviços exclusivos de WhatsApp/CRM devem ser removidos quando não houver dependências.

## Desenvolvimento
Requisitos: Bun e projeto Supabase próprio para o Projeto de Vida.

```sh
git clone -b projeto-de-vida https://github.com/renanaragao46/vendaai.git projeto-de-vida
cd projeto-de-vida
bun install
bun run dev
```

## Especificação
Consulte [docs/PROJECT_BLUEPRINT.md](docs/PROJECT_BLUEPRINT.md) para módulos, regras financeiras, métricas, rotina, plano de 180 dias, segurança e critérios de aceite.

## Segurança
Não versionar arquivos .env, tokens, service-role keys, senhas ou documentos pessoais. Usar somente variáveis de ambiente locais e secrets do provedor. A branch de trabalho remove o arquivo .env rastreado do snapshot atual; isso não apaga o histórico público anterior. Se algum valor privado tiver sido incluído em commits antigos, revogue/rotacione no provedor correspondente.

## Banco de dados
Criar um Supabase novo e isolado para o Projeto de Vida. Não reutilizar tabelas, usuários ou dados de produção do VendaAI sem auditoria, backup e migração explícita. Implementar RLS por workspace desde a primeira migration.

## Git / Lovable
Trabalhar inicialmente na branch `projeto-de-vida`. Conectar este repositório ao projeto Lovable Projeto de Vida pela interface GitHub do Lovable, selecionando esta branch. Fazer commits no GitHub como fonte de verdade; evitar prompts repetitivos de geração no Lovable para economizar créditos.
