# Rush Maestro — Roadmap Técnico Completo

> Este documento é o guia mestre para criação de tasks. Antes de iniciar qualquer sessão de implementação,
> leia este arquivo na íntegra. Ele descreve tudo que precisa ser feito, em ordem, com contexto técnico,
> decisões de arquitetura e trade-offs. Qualquer agente pode ler este arquivo e criar tasks a partir dele
> sem precisar de contexto adicional da conversa.

---

## 1. O que é o Rush Maestro hoje

Sistema local de gestão de marketing multi-tenant. Stack atual:

- **Runtime:** Bun
- **UI:** SvelteKit 2 + Svelte 5 runes + Tailwind v4
- **DB:** SQLite via `bun:sqlite` em `db/marketing.db`
- **MCP:** `@modelcontextprotocol/sdk` — Streamable HTTP em `POST /mcp`
- **Google Ads:** `google-ads-api` npm (v23), credenciais na tabela `integrations`
- **Armazenamento:** filesystem local em `storage/images/[tenant]/`

Funcionalidades operacionais hoje:
- Multi-tenant (tenants no SQLite)
- Posts/conteúdo social com workflow (draft → approved → scheduled → published)
- Relatórios em Markdown
- Campanhas Google Ads locais + live via API
- Monitoramento de métricas diárias (coleta + alertas)
- MCP server com 29 ferramentas para agentes externos
- Integrações OAuth (Google Ads) armazenadas no SQLite
- Settings com tabs (General + Integrations) por tenant

---

## 2. Para onde vai

**Rush Maestro será o "Coolify do marketing de performance":**
self-hosted, open source, instalável via Docker, com uma versão cloud para quem não quer operar a infra.

A migração de stack é obrigatória antes de qualquer feature nova relevante:

| Hoje | Depois |
|---|---|
| Bun + SvelteKit SSR | Go API + SvelteKit SPA (adapter-node → fetch()) |
| SQLite | PostgreSQL |
| Cron manual no sistema | Scheduler interno com UI (gocron) |
| Sem auth | JWT + RBAC dinâmico por workflow |
| Integrações parciais | Hub de integrações por grupo, repetíveis, por cliente |
| MCP em TypeScript | MCP em Go com auth por API key |
| Sem i18n | en + pt_BR desde o início |
| Sem testes E2E | testcontainers + Playwright |

**Prazo estimado para migração base:** menos de 1 mês (decisão tomada pelo dono do projeto).

---

## 3. Referência de arquitetura existente — rush-cms-v2

Existe um projeto Go em produção parcial em `/home/rafhael/www/html/rush-cms/rush-cms-v2/backend/`
que implementa o padrão de auth, RBAC e estrutura de pastas que o Rush Maestro deve adotar.

**O que reusar diretamente do rush-cms-v2:**

| Componente | Localização no v2 | O que aproveitar |
|---|---|---|
| JWT service | `internal/domain/jwt.go` | Access token 15min + refresh 7d, HS256 |
| Auth handlers | `internal/api/auth.go` | Login, refresh, logout, me, switch-site |
| Admin auth middleware | `internal/middleware/admin_auth.go` | JWT parse + RequirePermission |
| RBAC model | `internal/domain/user.go` + migrations `000017_create_rbac.sql` | permissions, roles, user_roles |
| ULID | `internal/domain/id.go` | Geração de IDs |
| Errors | `internal/domain/errors.go` | Padrão de erro tipado |
| Respond helpers | `internal/api/respond.go` | JSON responses padronizadas |
| CORS middleware | `internal/middleware/cors.go` | Admin CORS + per-site CORS |
| testcontainers setup | `testutil/db.go` + `testutil/seed.go` | Base para testes de integração |

**Stack do v2 (adotar integralmente):**
- Router: `go-chi/chi/v5`
- DB driver: `jackc/pgx/v5` + `pgxpool`
- Migrations: `pressly/goose/v3`
- Query generation: `sqlc` (queries em `.sql`, código gerado em `repository/db/`)
- Autenticação: `golang-jwt/jwt/v5`
- Hash: `golang.org/x/crypto` (bcrypt cost 12)
- Testes: `testcontainers-go` + `stretchr/testify`

---

## 4. Decisões de arquitetura (não renegociar sem motivo forte)

### 4.1 Go API + SvelteKit SPA (não Go servindo HTML)
**Decisão:** Go serve apenas a API REST + MCP. SvelteKit compila para SPA estática servida pelo Go como arquivos estáticos ou por nginx.

**Por:** Separação clara, SvelteKit continua no frontend sem reescrever telas, equipe pode trabalhar em paralelo.
**Contra:** Perde SSR (SEO não importa para painel admin). Fetch manual em vez de `+page.server.ts`. Streaming de AI via SSE precisa de endpoint Go dedicado.

### 4.2 SQLC para queries (não ORM)
**Decisão:** Todas as queries em arquivos `.sql`, código Go gerado pelo sqlc. Nenhum ORM.

**Por:** Queries legíveis, type-safe, zero magic, fácil de otimizar N+1. Rush-cms-v2 já valida o padrão.
**Contra:** Mais verboso que um ORM para CRUD simples. Toda query nova exige regenerar código.

### 4.3 PostgreSQL (não continuar com SQLite)
**Decisão:** Migrar para PostgreSQL.

**Por:** JSONB nativo, full-text search, pg_cron, pgvector para embeddings futuros, suporte a conexões concorrentes real, base para multi-tenant em cloud.
**Contra:** Infra mais pesada para dev local (resolvido com Docker Compose).

### 4.4 Integrações no banco (não em env vars ou arquivos)
**Decisão:** Todas as credenciais de integração vivem na tabela `integrations`. `.env` apenas para segredos de infra (DATABASE_URL, JWT_SECRET).

**Por:** Multi-tenant funciona; UI de gestão funciona; credenciais não vazam em arquivos commitados.
**Contra:** Segredos em banco (mitigado por: `.env` com DATABASE_URL fora do git, futuro: encrypt-at-rest ou OS keychain na versão desktop).

### 4.5 Open source desde o início
**Decisão:** Repositório público. IDs de clientes, tokens e credenciais nunca em arquivos commitados.

**Implicação técnica:** Sistema de templates de integrações precisa ser extensível por contribuição externa. Cada tipo de integração (provider) é um struct tipado com interface definida — não um mapa genérico de strings.

### 4.6 i18n desde o início (en + pt_BR)
**Decisão:** Toda string visível ao usuário passa por um sistema de tradução. Nenhuma string hardcoded no template.

**Por:** Open source com audiência global desde o lançamento; custo de adicionar depois é alto.
**Contra:** Overhead no desenvolvimento. Mitigado por: lib leve (paragraph/go-i18n para Go, svelte-i18n para UI), arquivos JSON por locale.

---

## 5. Estrutura de diretórios alvo (Go)

```
/
  Makefile                    — dev, build, migrate, test, lint, docker
  docker-compose.yml          — postgres + minio (R2 mock) + app
  Dockerfile                  — multi-stage: build Go + embed SvelteKit dist
  .env.example
  .mcp.json                   — aponta para localhost:8080/mcp

  cmd/
    server/main.go            — entry point HTTP
    migrate/main.go           — goose runner
    worker/main.go            — background workers (opcional, pode ser goroutine no server)

  internal/
    api/
      auth.go                 — login, refresh, logout, me
      admin_tenants.go        — tenant CRUD
      admin_users.go          — user + role CRUD
      admin_roles.go          — roles + permissions
      admin_integrations.go   — integration CRUD + OAuth flows
      admin_posts.go          — social posts
      admin_reports.go        — reports
      admin_campaigns.go      — Google Ads local drafts
      admin_alerts.go         — alerts inbox
      admin_schedule.go       — automations/cron
      mcp.go                  — MCP Streamable HTTP endpoint
      ai_stream.go            — SSE endpoint para streaming de LLM
      health.go

    domain/
      user.go                 — User, Role, Permission, UserClaims
      tenant.go               — Tenant, AdsMonitoringConfig
      integration.go          — Integration, IntegrationProvider (interface)
      post.go                 — Post, PostStatus, PostWorkflow
      report.go               — Report, ReportType
      campaign.go             — Campaign
      alert.go                — Alert, AlertLevel
      automation.go           — Automation, Schedule, EmailTemplate
      jwt.go                  — JWTService (copiar do v2)
      id.go                   — ULID (copiar do v2)
      errors.go               — erros tipados (copiar do v2)

    middleware/
      auth.go                 — JWT parse + RequirePermission
      tenant.go               — TenantFromContext
      cors.go
      logging.go

    repository/
      db/                     — código gerado pelo sqlc
      queries/                — *.sql (fonte do sqlc)
      user.go
      tenant.go
      integration.go
      post.go
      report.go
      campaign.go
      alert.go
      automation.go
      errors.go

    connector/
      interface.go            — AdsConnector, SocialConnector, StorageConnector, LLMProvider, EmailConnector
      googleads/              — Google Ads (porta do TypeScript atual)
      meta/                   — Meta Graph API (Facebook + Instagram)
      storage/
        local.go              — filesystem (dev)
        r2.go                 — Cloudflare R2 / S3-compatible
      llm/
        claude.go             — Anthropic SDK
        openai.go             — OpenAI (também cobre GPT-4o)
        groq.go               — Groq (interface OpenAI-compatible)
        gemini.go             — Google Gemini
      email/
        brevo.go
        sendible.go

    worker/
      metrics.go              — coleta diária Google Ads (porta do script atual)
      consolidate.go          — consolidação mensal
      reports.go              — geração e envio automático de relatórios
      scheduler.go            — gocron wrapper + persistência de jobs

    mcp/
      server.go               — cria McpServer, registra tools
      tools/
        content.go            — tenants, posts, reports, campaigns, alerts
        ads.go                — Google Ads read + write
        monitoring.go         — métricas, histórico
        ai.go                 — generate_content (chama LLM connector)

    i18n/
      loader.go               — carrega arquivos JSON de locale
      locales/
        en.json
        pt_BR.json

  migrations/
    000001_extensions.sql
    000002_tenants.sql
    000003_users.sql
    000004_rbac.sql
    000005_integrations.sql
    000006_posts.sql
    000007_reports.sql
    000008_campaigns.sql
    000009_metrics.sql
    000010_alerts.sql
    000011_automations.sql
    000012_audit_log.sql
    000013_seed_permissions.sql

  ui/                         — SvelteKit SPA (mover src/ atual para cá)
    src/
      lib/
        api/                  — fetch wrappers (substituem +page.server.ts)
        i18n/                 — svelte-i18n setup
        locales/
          en.json
          pt_BR.json
      routes/                 — mesmas rotas, sem +page.server.ts
    svelte.config.js          — adapter-static (SPA mode)
    ...

  testutil/
    db.go                     — SetupTestDB (testcontainers) — copiar do v2
    seed.go                   — fixtures

  scripts/                    — manter scripts Bun durante transição
```

---

## 6. Schema PostgreSQL — tabelas principais

### tenants
```sql
CREATE TABLE tenants (
  id              TEXT PRIMARY KEY,          -- slug: 'portico'
  name            TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'pt_BR',
  niche           TEXT,
  location        TEXT,
  primary_persona TEXT,
  tone            TEXT,
  instructions    TEXT,
  hashtags        JSONB NOT NULL DEFAULT '[]',
  ads_monitoring  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### users
```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,            -- ULID
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'en',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_setup_done BOOLEAN NOT NULL DEFAULT FALSE,  -- first-run flag
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### RBAC (copiar padrão do rush-cms-v2 + adicionar dimensão de workflow)
```sql
CREATE TABLE permissions (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE  -- 'create:post', 'approve:post', 'schedule:post', 'publish:post'
                             -- 'manage:integrations', 'view:reports', 'manage:automations'
);

CREATE TABLE roles (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = role global
  UNIQUE (name, tenant_id)
);

CREATE TABLE role_permissions (
  role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_tenant_roles (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id   TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tenant_id, role_id)
);
```

**Permissões de workflow para posts:**
- `create:post` — pode criar rascunhos
- `review:post` — pode comentar e devolver
- `approve:post` — pode mover para approved
- `schedule:post` — pode definir data/hora e mover para scheduled
- `publish:post` — pode publicar manualmente
- `delete:post` — pode excluir

**Roles padrão:**
- `owner` — tudo
- `manager` — tudo exceto gestão de usuários e integrações
- `content_creator` — create:post, view:reports
- `content_approver` — review:post, approve:post, view:reports
- `scheduler` — schedule:post, publish:post
- `client_viewer` — view:reports, approve:post (cliente acompanhando)

### integrations
```sql
CREATE TABLE integrations (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = global
  name                TEXT NOT NULL,
  provider            TEXT NOT NULL,        -- 'google_ads' | 'meta' | 'r2' | 's3' | 'claude' | 'openai' | 'groq' | 'gemini' | 'brevo' | 'sendible' | 'sentry'
  group               TEXT NOT NULL,        -- 'ads' | 'social_media' | 'media' | 'llm' | 'email' | 'monitoring'
  config              JSONB NOT NULL DEFAULT '{}',  -- campos específicos do provider (schema tipado por provider)
  credentials         JSONB NOT NULL DEFAULT '{}',  -- segredos (oauth tokens, api keys)
  status              TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'connected' | 'error'
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE integration_tenants (
  integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (integration_id, tenant_id)
);
```

**Nota sobre `config` vs `credentials`:** A separação existe para que `config` (cliente_id, developer_token, bucket_name) possa ser exibida na UI sem risco, e `credentials` (client_secret, refresh_token, api_key) fique separada e futuramente possa ser criptografada ou movida para um secret manager.

**Nota sobre integrações repetíveis:** O modelo permite múltiplas rows com o mesmo `provider`. Ex: duas integrações `google_ads`, uma para o tenant A, outra para B+C. Duas integrações `r2`, uma para mídia e outra para backups. A UI apresenta isso como cards separados.

### audit_log
```sql
CREATE TABLE audit_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id),
  tenant_id   TEXT REFERENCES tenants(id),
  action      TEXT NOT NULL,          -- 'post.approved', 'integration.connected', 'campaign.budget_updated'
  entity_type TEXT NOT NULL,          -- 'post', 'integration', 'campaign', 'user', 'report'
  entity_id   TEXT NOT NULL,
  before      JSONB,                  -- estado anterior (nullable)
  after       JSONB,                  -- estado novo (nullable)
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant ON audit_log (tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);
```

### automations
```sql
CREATE TABLE automations (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,          -- 'report_email' | 'metrics_collect' | 'post_publish'
  schedule    TEXT NOT NULL,          -- cron expression: '0 8 * * 1' (toda segunda 8h)
  config      JSONB NOT NULL DEFAULT '{}',  -- parâmetros do job
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,                   -- 'success' | 'error'
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 7. Interface de Integrações — padrão de extensibilidade

Cada provider é um struct Go que implementa a interface relevante. Isso garante type-safety e facilita contribuições externas.

```go
// connector/interface.go

type AdsConnector interface {
  GetCampaigns(ctx context.Context, tenantID string) ([]Campaign, error)
  GetMetrics(ctx context.Context, params MetricsParams) (Metrics, error)
  UpdateBudget(ctx context.Context, campaignID string, dailyBudgetBRL float64) error
  AddNegativeKeywords(ctx context.Context, campaignID string, keywords []string) error
  // ...
}

type SocialConnector interface {
  PublishPost(ctx context.Context, post Post) (ExternalPostID string, error)
  GetInsights(ctx context.Context, postID string) (Insights, error)
}

type StorageConnector interface {
  Put(ctx context.Context, tenant, key string, data io.Reader, mime string) error
  GetURL(tenant, key string) string
  Delete(ctx context.Context, tenant, key string) error
}

type LLMProvider interface {
  Complete(ctx context.Context, req LLMRequest) (LLMResponse, error)
  Stream(ctx context.Context, req LLMRequest) (<-chan LLMChunk, error)
}

type EmailConnector interface {
  Send(ctx context.Context, msg EmailMessage) error
  SendTemplate(ctx context.Context, templateID string, data any, to []string) error
}
```

**Cada provider registra sua IntegrationSchema:**
```go
type IntegrationSchema struct {
  Provider    string
  Group       string
  DisplayName string
  LogoSVG     string              // SVG inline para o card na UI
  ConfigFields []FieldSchema      // campos exibidos na UI (não-secretos)
  CredentialFields []FieldSchema  // campos secretos (masked na UI)
  OAuthSupported bool
  TestConnection func(ctx context.Context, cfg IntegrationConfig) error
}
```

Esta struct é o que a UI usa para renderizar o setup modal de cada integração — dinâmico, não hardcoded. Para adicionar um novo provider, você cria o arquivo Go e registra a schema. A comunidade pode contribuir com PRs adicionando novos providers sem alterar nenhum código existente.

---

## 8. Email templates — sistema tipado

Templates de email para automações precisam ser tipados para garantir que os dados necessários estão presentes e que a UI pode validar.

```go
type ReportEmailData struct {
  TenantName  string
  Period      string        // "Semana de 28/04 a 04/05/2026"
  ReportType  string        // "Relatório Semanal de Google Ads"
  MetricCards []MetricCard  // impressões, cliques, CPA, etc.
  Summary     string        // texto gerado por LLM
  ReportURL   string        // link para ver o relatório completo
}

type MetricCard struct {
  Label  string
  Value  string
  Delta  string  // "+12% vs semana anterior"
  Status string  // "good" | "warning" | "critical"
}
```

Templates HTML ficam em `internal/email/templates/*.html` (Go `html/template`). Cada template tem um ID string que a automação referencia. A validação de tipo acontece na compilação — se um template espera `ReportEmailData` e o worker tenta passar outra struct, não compila.

Para a comunidade adicionar templates: criar arquivo `.html` + struct Go + registrar no `registry.go`. O mesmo padrão da IntegrationSchema.

---

## 9. i18n — padrão de implementação

### Backend (Go)
Lib: `nicksnyder/go-i18n/v2`

```go
// internal/i18n/loader.go
bundle := i18n.NewBundle(language.English)
bundle.RegisterUnmarshalFunc("json", json.Unmarshal)
bundle.LoadMessageFile("locales/en.json")
bundle.LoadMessageFile("locales/pt_BR.json")
```

Strings nos handlers:
```go
// ❌ hardcoded
return errors.New("Integration not found")

// ✅ i18n
msg := localizer.MustLocalize(&i18n.LocalizeConfig{MessageID: "error.integration_not_found"})
return errors.New(msg)
```

Locale do usuário: lido do JWT claims (`user.locale`), padrão `en`.

### Frontend (SvelteKit)
Lib: `svelte-i18n`

```
ui/src/lib/locales/
  en.json
  pt_BR.json
```

```svelte
<script>
  import { t } from 'svelte-i18n'
</script>
<h1>{$t('settings.integrations.title')}</h1>
```

### Escopo inicial de tradução (en + pt_BR)
- Todos os labels da UI (nav, botões, títulos de seção)
- Mensagens de erro exibidas ao usuário
- Mensagens de status de integrações
- Labels de status de posts e workflow
- Alertas e notificações
- Emails automáticos (templates separados por locale)

**Convenção de chaves:**
```
section.subsection.element
ex: settings.integrations.connect_button
    post.workflow.approve_confirm
    alert.no_conversion.message
    email.weekly_report.subject
```

---

## 10. Fases de implementação — ordem e dependências

### FASE 0 — Fundação Go (bloqueante para tudo)
**O que:** Estrutura do projeto Go, Makefile, Docker Compose, primeira migration rodando.

**Tasks:**
- [ ] Criar módulo Go (`go mod init github.com/rush-maestro/rush-maestro`)
- [ ] Estrutura de pastas conforme seção 5
- [ ] Copiar domain utilities do rush-cms-v2: `id.go`, `errors.go`, `jwt.go`
- [ ] Configurar Goose + primeira migration (extensions + schema vazio)
- [ ] `docker-compose.yml` com PostgreSQL 16 + MinIO (mock R2 local)
- [ ] Makefile com targets: `dev`, `build`, `migrate`, `test`, `lint`, `docker-build`
- [ ] `cmd/server/main.go` com chi, health route, config por env var
- [ ] `cmd/migrate/main.go` com Goose runner
- [ ] `.env.example` documentado
- [ ] Variáveis obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `ADMIN_CORS_ORIGINS`
- [ ] SQLC configurado (`sqlc.yaml`)

**Dependência:** nenhuma — primeiro a ser feito.

---

### FASE 1 — Auth + First-run (bloqueante para qualquer tela protegida)
**O que:** Sistema de auth completo copiando o padrão do rush-cms-v2. Onboarding estilo Coolify.

**Tasks:**
- [ ] Migration `000003_users.sql`
- [ ] Migration `000004_rbac.sql` (permissions, roles, user_tenant_roles)
- [ ] Migration `000013_seed_permissions.sql` (28+ permissions + roles padrão)
- [ ] Domínio: `domain/user.go` (User, Role, Permission, UserClaims) — adaptar do v2
- [ ] Repository: `repository/user.go` + `repository/rbac.go` + queries SQL
- [ ] JWT service: copiar `domain/jwt.go` do v2 sem alterações
- [ ] Handlers: `api/auth.go` (login, refresh, logout, me, change-password) — adaptar do v2
- [ ] Middleware: `middleware/auth.go` (AuthenticateAdmin + RequirePermission) — copiar do v2
- [ ] **First-run detection:** se `SELECT COUNT(*) FROM users = 0`, retornar flag `setup_required: true` em `GET /health`
- [ ] **Setup endpoint:** `POST /setup` — cria o primeiro usuário owner (desabilitado após primeiro uso)
- [ ] Handler `admin_users.go` — CRUD de usuários + assignRole
- [ ] Handler `admin_roles.go` — CRUD de roles + permissões
- [ ] **UI — Login screen:** `/login` route no SvelteKit SPA
- [ ] **UI — First-run screen:** se `setup_required`, redirecionar para `/setup` (some após criar o primeiro usuário)
- [ ] i18n: strings de auth em `en.json` + `pt_BR.json`

**Dependência:** Fase 0.

---

### FASE 2 — Migração de dados SQLite → PostgreSQL
**O que:** Replicar o schema atual do SQLite no PostgreSQL e migrar os dados existentes.

**Tasks:**
- [ ] Migration `000002_tenants.sql`
- [ ] Migration `000006_posts.sql`
- [ ] Migration `000007_reports.sql`
- [ ] Migration `000008_campaigns.sql`
- [ ] Migration `000009_metrics.sql` (daily_metrics + monthly_summary)
- [ ] Migration `000010_alerts.sql` (alert_events)
- [ ] Migration `000005_integrations.sql` (integrations + integration_tenants)
- [ ] Script de migração de dados: lê `db/marketing.db`, insere no PostgreSQL
- [ ] Repositories Go para todas as entidades acima + queries SQLC
- [ ] Verificação: contar rows migradas vs SQLite original

**Dependência:** Fase 0.

---

### FASE 3 — API REST core + SvelteKit SPA
**O que:** Portar as rotas que hoje existem no SvelteKit SSR para handlers Go + SvelteKit SPA com fetch().

**Tasks:**
- [ ] `admin_tenants.go` — CRUD de tenants
- [ ] `admin_posts.go` — CRUD de posts + update status
- [ ] `admin_reports.go` — CRUD de reports
- [ ] `admin_campaigns.go` — CRUD de campaigns locais
- [ ] `admin_alerts.go` — listar + marcar como lido/ignorado
- [ ] Remover todos os `+page.server.ts` do SvelteKit que fazem DB calls diretos
- [ ] Criar `ui/src/lib/api/` — wrappers fetch() para cada endpoint Go
- [ ] `svelte.config.js` — mudar para `adapter-static` com `fallback: '200.html'` (SPA)
- [ ] Go serve `ui/dist/` como static files + fallback para SPA
- [ ] i18n: strings das telas principais

**Dependência:** Fases 0 + 2.

---

### FASE 4 — Hub de Integrações
**O que:** A página `/settings/integrations` reformulada como cards estilo Coolify, com o sistema de providers extensível.

**Tasks:**
- [ ] Migration `000005_integrations.sql` (se não feita na fase 2)
- [ ] Migration `000012_audit_log.sql`
- [ ] `domain/integration.go` — IntegrationSchema, interfaces por grupo
- [ ] `connector/interface.go` — todas as interfaces de connector
- [ ] Registry de providers (em memória, registrado no startup)
- [ ] `admin_integrations.go` — CRUD + OAuth initiation + callback handlers
- [ ] OAuth flows: Google Ads (porta do TypeScript atual) + Meta (novo)
- [ ] **UI `/settings/integrations`:** grid de cards por grupo (Ads, Social Media, Media, LLM, Email, Monitoring)
- [ ] Cada card: logo SVG, nome, status badge, botão "Configure" → modal de setup
- [ ] Modal de setup: campos dinâmicos baseados em `IntegrationSchema.ConfigFields`
- [ ] Campos de credencial: masked, com toggle de visibilidade
- [ ] Botão "Test Connection" → `POST /admin/integrations/{id}/test`
- [ ] Suporte a múltiplas instâncias do mesmo provider (lista, não único)
- [ ] Seleção de clientes por integração (MultiSelect com todos os tenants)
- [ ] Remover `google_ads_id` do formulário de tenant settings (agora é a integração)
- [ ] i18n: strings do hub de integrações

**Dependência:** Fases 1 + 3.

---

### FASE 5 — MCP Server em Go
**O que:** Portar o MCP server TypeScript para Go. Mantém compatibilidade 1:1 de tools e resources.

**Tasks:**
- [ ] `internal/mcp/server.go` — handler HTTP para `POST /mcp` + `GET /mcp` (SSE)
- [ ] Implementar MCP Streamable HTTP protocol (JSON-RPC 2.0 sobre HTTP)
- [ ] `mcp/tools/content.go` — 15 tools de conteúdo (list_tenants, create_post, etc.)
- [ ] `mcp/tools/ads.go` — 10 tools Google Ads (read + write)
- [ ] `mcp/tools/monitoring.go` — 4 tools de monitoramento
- [ ] `mcp/tools/ai.go` — `generate_content` tool (chama LLM connector)
- [ ] Resources: `tenant://list`, `tenant://{id}/brand`, etc.
- [ ] Auth no MCP: API key por tenant em header `Authorization: Bearer sk-maestro-xxx`
- [ ] Atualizar `.mcp.json` para apontar para `http://localhost:8080/mcp`
- [ ] Testes de integração do MCP (tool list, tool call básico)

**Dependência:** Fases 2 + 4 (precisa dos connectors disponíveis).

---

### FASE 6 — Connectors: Google Ads + R2/S3
**O que:** Portar o conector Google Ads do TypeScript para Go. Implementar storage adapter R2/S3.

#### Google Ads
- [ ] `connector/googleads/client.go` — factory usando creds da tabela integrations
- [ ] `connector/googleads/campaigns.go` — GetLiveCampaigns, GetSearchTerms, GetAdGroups, GetCriteria
- [ ] `connector/googleads/mutations.go` — AddNegativeKeywords, UpdateBudget, SetSchedule, etc.
- [ ] `worker/metrics.go` — porta `scripts/collect-daily-metrics.ts`
- [ ] `worker/consolidate.go` — porta `scripts/consolidate-monthly.ts`
- [ ] Testar com customer ID real do Pórtico

#### R2/S3
- [ ] `connector/storage/local.go` — filesystem local (dev)
- [ ] `connector/storage/r2.go` — Cloudflare R2 via AWS SDK v2 (S3-compatible)
- [ ] `connector/storage/s3.go` — AWS S3 padrão
- [ ] Go serve `GET /media/{tenant}/{key}` — proxy ou redirect para R2 URL pública
- [ ] Migrar imagens existentes de `storage/images/` para R2 bucket (script one-time)
- [ ] UI: upload de imagem em posts agora usa R2 (quando integração configurada)

**Dependência:** Fase 4 (connectors precisam ler creds das integrations).

---

### FASE 7 — Connectors: LLM
**O que:** Unified LLM provider para geração de conteúdo server-side (sem depender do Claude Code CLI).

**Tasks:**
- [ ] `domain/llm.go` — LLMRequest, LLMResponse, LLMChunk structs
- [ ] `connector/llm/claude.go` — Anthropic SDK para Go (`anthropics/anthropic-sdk-go`)
  - Suporte a tool use, prompt caching, streaming
  - `model`: claude-sonnet-4-6 como padrão, configurável
- [ ] `connector/llm/openai.go` — OpenAI Go SDK
- [ ] `connector/llm/groq.go` — OpenAI-compatible (mesma struct, URL diferente)
- [ ] `connector/llm/gemini.go` — Google Generative AI SDK
- [ ] Registry de providers: tenant config determina qual usar por tipo de task
  - `report_generation` → Claude (qualidade)
  - `post_draft` → Groq (velocidade + custo)
  - `image_analysis` → Gemini (multimodal)
- [ ] `api/ai_stream.go` — `POST /ai/generate` com SSE para streaming na UI
- [ ] MCP tool `generate_content` chama o LLM registry (não hardcoda Claude)
- [ ] i18n: mensagens de erro de LLM

**Dependência:** Fase 4.

---

### FASE 8 — Connector: Meta (Facebook + Instagram)
**O que:** Publicação de posts em páginas Facebook e contas Instagram Business via Meta Graph API.

**Prerequisito:** R2/S3 operacional (Meta precisa de URL pública para upload de mídia).

**Tasks:**
- [ ] OAuth 2.0 Meta: `/auth/meta/start` → redirect → `/auth/meta/callback` → salva token em integrations
- [ ] Scopes necessários: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
- [ ] `connector/meta/client.go` — factory usando creds da integração
- [ ] `connector/meta/publish.go` — fluxo completo:
  1. Upload de imagem → Media Container ID (assíncrono, polling de status)
  2. Publish com container ID + caption
  3. Suporte a múltiplas imagens (carousel)
- [ ] `connector/meta/pages.go` — listar Facebook Pages e IG accounts disponíveis no token
- [ ] `admin_posts.go` — action `PublishPost` chama connector Meta
- [ ] Webhook handler (opcional, fase posterior): confirmar publicação, capturar insights
- [ ] UI: badge "Publish to Meta" em post com status approved/scheduled
- [ ] i18n: strings de publicação Meta

**Dependência:** Fases 4 + 6 (R2 obrigatório para imagens).

---

### FASE 9 — Workflow RBAC + Audit Log
**O que:** Aplicar as permissões de workflow nas rotas de posts. Implementar log de auditoria.

**Tasks:**
- [ ] Mapear permissões de workflow para cada endpoint de post
  - `POST /admin/posts` → `RequirePermission("create:post")`
  - `PUT /admin/posts/{id}/status` → permissão depende do status-alvo
- [ ] `api/admin_posts.go` — verificar permissão antes de cada transição de status
- [ ] `repository/audit.go` — InsertAuditLog, ListAuditLog (por tenant, por entidade)
- [ ] Middleware ou helper `AuditAction(action, entityType, entityID, before, after)` — chamado após cada mutation
- [ ] UI `/[tenant]/audit` — tabela de histórico de ações (quem fez o quê quando)
- [ ] Filtros: por ação, por usuário, por entidade, por período
- [ ] UI `/settings/users` — gestão de usuários por tenant + atribuição de roles
- [ ] UI: botões de ação em posts condicionais à permissão do usuário logado
- [ ] i18n: strings de audit log e permissões

**Dependência:** Fase 3.

---

### FASE 10 — Automações (Cron com UI)
**O que:** Sistema de cron jobs configurável pela UI, substituindo o crontab manual.

**Tasks:**
- [ ] Migration `000011_automations.sql`
- [ ] `worker/scheduler.go` — gocron wrapper que lê automations table e agenda jobs
- [ ] `worker/reports.go` — gera relatório + envia por email via connector
- [ ] `api/admin_schedule.go` — CRUD de automações
- [ ] Tipos de automação:
  - `metrics_collect` — coleta diária de métricas (porta do script atual)
  - `monthly_consolidate` — consolida métricas mensais
  - `report_email` — gera relatório + envia por email
  - `post_publish` — publica posts agendados
- [ ] `connector/email/brevo.go` — Send + SendTemplate
- [ ] `connector/email/sendible.go`
- [ ] Sistema de templates de email (seção 8 deste doc)
  - Templates iniciais: `weekly_ads_report`, `monthly_ads_report`, `alert_notification`
- [ ] UI `/[tenant]/automations` — lista de automações com status, última execução, logs
- [ ] UI: formulário de criação de automação (tipo, cron expression com preview humanizado, config)
- [ ] Refatorar `/[tenant]/schedule` atual — se tornar a tela de automações
- [ ] i18n: strings de automações

**Dependência:** Fases 4 (email connector) + 7 (LLM para gerar conteúdo de report).

---

### FASE 11 — Alertas reais
**O que:** Sistema de alertas com contador, drawer, e gestão de leitura.

**Tasks:**
- [ ] Layout Go: `GET /admin/alerts/count` — retorna número de alertas não-lidos por tenant
- [ ] `GET /admin/alerts` — lista paginada com filtros
- [ ] `PUT /admin/alerts/{id}/read` — marcar como lido
- [ ] `PUT /admin/alerts/read-all` — marcar todos como lidos
- [ ] UI: badge numérico no ícone de sino no nav (polling a cada 60s ou WebSocket)
- [ ] UI: drawer lateral de alertas (lista com CRITICAL em vermelho, WARN em amarelo)
- [ ] UI: botão "Ver todos" → `/[tenant]/alerts` (tela existente, refatorada)
- [ ] i18n: strings de alertas

**Dependência:** Fase 3.

---

### FASE 12 — Onboarding + Docker
**O que:** Experiência de primeiro acesso estilo Coolify. Build Docker para deploy self-hosted.

**Tasks:**
- [ ] `GET /health` retorna `{ "status": "ok", "setup_required": bool }`
- [ ] UI: se `setup_required`, redirecionar para `/setup` antes do login
- [ ] `/setup` — form de criação do primeiro usuário (nome, email, senha)
- [ ] Após criar, redirecionar para `/login` normalmente
- [ ] `Dockerfile` multi-stage:
  1. Stage `ui-build`: Node + bun, compila SvelteKit SPA
  2. Stage `go-build`: Go, compila binário
  3. Stage final: binário Go + `ui/dist/` embeddado via `embed.FS`
- [ ] `docker-compose.yml` para produção: app + postgres + minio
- [ ] `docker-compose.dev.yml` para desenvolvimento local (hot reload)
- [ ] Volume para `db/` (migrations automáticas no startup)
- [ ] Documentar variáveis de ambiente no README público
- [ ] i18n: strings de onboarding

**Dependência:** Fases 1 + 3.

---

### FASE 13 — Testes
**O que:** Cobertura de testes em camadas. Não é fase final — cada fase anterior deve ter testes unitários mínimos. Esta fase foca em testes de integração e E2E completos.

**Testes unitários (junto com cada fase):**
- Domain models: lógica de negócio, validações, transformações
- Connectors: mock das APIs externas, não chamadas reais

**Testes de integração (com testcontainers — padrão do rush-cms-v2):**
- [ ] Setup `testutil/db.go` copiado do rush-cms-v2, adaptado para Rush Maestro
- [ ] `testutil/seed.go` — fixtures: CreateTenant, CreateUser, CreatePost, CreateIntegration
- [ ] Auth: login, refresh, permissões, first-run
- [ ] Posts: CRUD, transições de status, workflow permissions
- [ ] Integrações: criação, test connection, OAuth callback mock
- [ ] MCP: tool list, tool calls (com mock de connectors externos)
- [ ] Alertas: criação, contagem, marcar como lido

**Testes E2E (Playwright):**
- [ ] Login flow
- [ ] First-run setup
- [ ] Criar post → aprovar → agendar (workflow completo)
- [ ] Configurar integração (mock OAuth)
- [ ] Criar automação + verificar agendamento

**Observabilidade em produção:**
- [ ] Sentry Go SDK (`getsentry/sentry-go`) — captura panics + errors
- [ ] Sentry Svelte SDK — erros de frontend
- [ ] Sentry como integração configurável no hub (grupo `monitoring`)
- [ ] Performance monitoring: `sentry.StartSpan` em queries longas e chamadas a APIs externas
- [ ] N+1 detection: log de queries que excedem threshold configurável (ex: >50ms)
- [ ] Métricas de memória expostas em `GET /metrics` (Prometheus format — opcional)
- [ ] Grafana: documentar como conectar ao endpoint de métricas (não implementar agora, apenas preparar)

**Dependência:** Cada teste de integração depende da fase que testa.

---

## 11. Migração do SvelteKit — estratégia incremental

Não reescrever tudo de uma vez. Estratégia:

1. **Manter SvelteKit funcionando** durante a migração — o servidor TypeScript continua rodando para não perder acesso aos dados reais durante o desenvolvimento Go
2. **Converter `+page.server.ts` para `+page.ts`** com `fetch()` para a Go API — um por vez
3. **Mover para `adapter-static`** apenas quando todos os `+page.server.ts` estiverem convertidos
4. **Não migrar os scripts Bun** — eles viram workers Go na Fase 6, mas durante a transição continuam funcionando como estão

Ordem sugerida de conversão (do menos dependente para o mais):
1. Root page (tenant list) — só GET
2. Reports — só GET
3. Alerts — GET + POST simples
4. Posts — CRUD + status transitions
5. Campaigns — CRUD
6. Settings — inclui integrações (precisa de Fase 4)

---

## 12. O que NÃO fazer antes de terminar a migração de stack

- Não adicionar novos connectors no TypeScript (serão reescritos em Go)
- Não adicionar novas telas com `+page.server.ts` (serão convertidas para fetch())
- Não modificar o schema SQLite (esforço desperdiçado — vai para PostgreSQL)
- Não implementar auth no SvelteKit atual (a auth vai ser Go)

O único trabalho válido no stack atual antes da migração:
- Bugfixes em produção
- Novos relatórios via MCP (não dependem de code changes)
- Ajustes de copy/estilo que não exigem nova lógica

---

## 13. Checklist de prontidão para open source

Antes de tornar o repositório público:

- [ ] Nenhum ID de cliente, token ou credencial em arquivos commitados
- [ ] `.env.example` documentado com todos os campos
- [ ] `CONTRIBUTING.md` explicando como adicionar um novo provider
- [ ] `LICENSE` (MIT ou Apache 2.0 — a definir)
- [ ] README público com: o que é, como instalar via Docker, como configurar
- [ ] Secrets scanning no CI (gitleaks ou similar)
- [ ] Primeira release Docker image publicada no ghcr.io

---

## 14. Referências rápidas para agentes

### Onde está o que no projeto atual (SvelteKit)
- MCP tools: `src/lib/server/mcp/tools/`
- Integrações DB: `src/lib/server/db/integrations.ts`
- Tenants: `src/lib/server/tenants.ts`
- Google Ads client: `src/lib/server/googleAdsClient.ts`
- Storage: `src/lib/server/storage.ts`
- Schema atual: `db/migrations/001_schema.sql` a `005_posts_platform.sql`

### Onde está o que no rush-cms-v2 (padrão Go a adotar)
- JWT service: `internal/domain/jwt.go`
- Auth handlers: `internal/api/auth.go`
- RBAC migration: `migrations/000017_create_rbac.sql`
- Permissions seed: `migrations/000020_seed_permissions_and_roles.sql`
- Middleware auth: `internal/middleware/admin_auth.go`
- Test setup: `testutil/db.go` + `testutil/seed.go`
- Router setup: `cmd/server/main.go`

### Comandos úteis
```bash
# Projeto atual — rodar dev
cd /home/rafhael/www/html/marketing && bun run dev

# Projeto atual — checar TypeScript
bun run check

# rush-cms-v2 — rodar
cd /home/rafhael/www/html/rush-cms/rush-cms-v2/backend && air

# rush-cms-v2 — rodar testes
go test -v ./internal/domain
go test -v -tags=integration ./internal/api
```

---

*Documento gerado em 25/04/2026. Atualizar conforme decisões forem tomadas.*
*Próxima ação: criar tasks individuais a partir das fases 0 e 1.*
