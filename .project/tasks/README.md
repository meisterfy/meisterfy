# Tasks — Marketing CMS Refactor

Refatoração guiada pelo **ADR-001** (`.project/adrs/001-sveltekit-sqlite-mcp.md`).  
Objetivo: mover SvelteKit para a raiz, substituir flat-files por SQLite, expor MCP em `/mcp`.

---

## Estado atual

**Refatoração concluída. Todas as tasks T01–T10 foram completadas.**

| Task | Status | Descrição |
|---|---|---|
| T01 | ✅ completed | Move SvelteKit de `ui/` para root |
| T02 | ✅ completed | Drop dual-runtime shim, usar `bun:sqlite` direto |
| T03 | ✅ completed | Migrations SQLite: tenants, posts, reports, campaigns |
| T04 | ✅ completed | Seed script: flat-files → SQLite |
| T05 | ✅ completed | Funções TS da camada de dados (`src/lib/server/`) |
| T06 | ✅ completed | Storage adapter interface + implementação local |
| T07 | ✅ completed | Migrar rotas UI de `fs.readFile` para funções SQLite |
| T08 | ✅ completed | MCP server setup em `/mcp` via SvelteKit |
| T09 | ✅ completed | MCP tools e resources |
| T10 | ✅ completed | Cleanup: remover flat-files, atualizar scripts e CLAUDE.md |

---

## Resultado final

- SvelteKit na raiz (`src/`), Bun como único runtime
- SQLite (`db/marketing.db`) é a fonte de verdade para tenants, posts, reports e campaigns
- MCP server em `POST /mcp` com 16 tools e 5 resources
- Scripts simplificados: leem de SQLite, não de `clients/`
- `clients/` contém apenas imagens legadas (duplicatas de `storage/images/`)
- CLAUDE.md atualizado para refletir a nova arquitetura

---

## Regras do projeto

- Commits seguem Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Tasks concluídas vão para `tasks/completed/` com `**Status:** completed`
- Nunca alterar campanhas Google Ads ao vivo sem confirmação explícita
- IDs de clientes e tracking tags nunca entram em arquivos commitados
