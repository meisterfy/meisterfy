# Arquitetura V2 — Go + PostgreSQL + MCP Público + Multi-Connector

Evolução natural do projeto atual (SvelteKit + SQLite + MCP local) para uma plataforma multi-tenant com backend robusto, integrações extensíveis e IA via UI.

---

## Visão geral

```
┌─────────────────────────────────────────────────────┐
│  SvelteKit UI (SPA puro)                            │
│  fetch() → Go API  |  SSE para AI streaming         │
└──────────────┬──────────────────────────────────────┘
               │ REST / JSON
┌──────────────▼──────────────────────────────────────┐
│  Go API  (chi/fiber)                                │
│  ├── /api/*         — CRUD, uploads, deploys        │
│  ├── /mcp           — MCP Streamable HTTP (público) │
│  ├── /ai/*          — proxy multi-provider          │
│  └── workers        — coleta métricas, sync, backup │
└──────────────┬──────────────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
  PostgreSQL        R2 / S3
  (conteúdo +       (imagens,
   métricas)         backups)
               │
┌──────────────▼──────────────────────────────────────┐
│  Python service  (opcional, localhost:8001)          │
│  RAG · embeddings · orquestrações avançadas         │
└─────────────────────────────────────────────────────┘
```

---

## Stack

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Build | Make | Orquestra todos os serviços com targets simples |
| UI | SvelteKit (SPA) | Mantém o que existe, remove SSR, vira SPA puro |
| API | Go (chi ou fiber) | Performance, binário único, excelente pra workers |
| DB | PostgreSQL | JSONB, full-text search, pg_cron, pgvector |
| Object storage | Cloudflare R2 | Zero egress, API S3-compatible |
| AI | Groq / OpenAI / Claude / Gemini | Multi-provider via interface única |
| RAG | Python (FastAPI + pgvector) | Ecossistema insubstituível pra embeddings |
| MCP | Go (endpoint HTTP público) | Serve IDE, terminal e agentes cloud |

---

## Makefile — targets principais

```makefile
make dev        # sobe todos os serviços (Go API + SvelteKit + Python)
make build      # build de produção
make migrate    # roda migrations Postgres
make seed       # seed inicial
make test       # testa Go + UI
make deploy     # build + push imagens Docker
```

---

## Go API — estrutura interna

```
api/
  cmd/server/main.go
  internal/
    handler/        — HTTP handlers por domínio
    service/        — lógica de negócio
    connector/      — integrações externas
      googleads/
      meta/
      canva/
      linkedin/
    ai/             — abstração multi-provider
    mcp/            — servidor MCP
    worker/         — background jobs
    storage/        — abstração R2/S3
  db/
    migrations/     — SQL versionado (golang-migrate)
    queries/        — sqlc ou pgx direto
```

### Interface Connector

```go
type Connector interface {
    Name() string
    Publish(ctx context.Context, post Post) error
    GetMetrics(ctx context.Context, params MetricParams) (Metrics, error)
}
```

Cada tenant configura quais conectores ativa. Google Ads, Meta, Canva Export, LinkedIn, TikTok implementam essa interface.

### Interface AI Provider

```go
type AIProvider interface {
    Complete(ctx context.Context, prompt string, opts Options) (string, error)
    Stream(ctx context.Context, prompt string, opts Options) (<-chan string, error)
}
```

| Provider | Uso ideal |
|---|---|
| Groq (Llama 4) | Drafts rápidos, respostas curtas |
| Claude | Relatórios, revisão de qualidade, análise |
| Gemini | Multimodal (análise de imagem do post) |
| OpenAI | Embeddings para RAG |

Tenant escolhe provider padrão por tipo de tarefa.

---

## PostgreSQL — schema principal

Mesma estrutura do SQLite atual, mais:

```sql
-- Suporte a full-text search em posts e relatórios
ALTER TABLE posts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(title,'') || ' ' || content)
  ) STORED;

-- JSONB para workflow e ads data com query eficiente
-- workflow->>'strategy' funciona direto

-- pgvector para embeddings (RAG)
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE reports ADD COLUMN embedding vector(1536);
```

---

## MCP público

O endpoint `/mcp` sai do SvelteKit e vai para o Go API. Com isso:

- **Auth:** API key por tenant (`Bearer sk-tenant-xxx`) no header
- **Multi-dispositivo:** Claude Code local, IDE remoto, agente cloud — todos apontam pro mesmo URL
- **URL:** `https://mcp.seutool.com/[tenant]?key=xxx` ou `http://localhost:8080/mcp` para dev local

O `.mcp.json` continua funcionando, só muda a URL:
```json
{
  "mcpServers": {
    "marketing": {
      "type": "http",
      "url": "http://localhost:8080/mcp",
      "headers": { "Authorization": "Bearer sk-dev-xxx" }
    }
  }
}
```

As tools T09 (list_tenants, create_post, etc.) migram 1:1 para o Go MCP.

---

## R2 / S3

```
Bucket: marketing-media
  [tenant]/posts/[filename]     — imagens de posts
  [tenant]/campaigns/[filename] — assets de campanhas

Bucket: marketing-backups
  [YYYY-MM-DD]/postgres.dump.gz — backup diário automático (worker Go)
```

O worker de backup roda via `pg_dump | gzip | upload_to_r2` agendado com `time.AfterFunc` ou cron interno do Go.

---

## Python (opcional — só quando necessário)

Serviço leve em FastAPI, chamado via HTTP pelo Go:

```
ml/
  main.py
  routes/
    rag.py        — busca semântica em relatórios e posts
    embed.py      — gera embeddings (OpenAI text-embedding-3-small)
  requirements.txt
```

Casos de uso concretos:
- "Mostre relatórios similares a este" (busca por embedding em reports)
- "Que campanhas funcionaram para esse tipo de produto?" (query histórico + semântica)
- Orquestrações multi-step complexas (LangGraph, CrewAI) se necessário

**Quando adicionar:** só quando o volume de relatórios/posts justificar busca semântica (>200 relatórios ou >1000 posts). Antes disso, full-text search no Postgres resolve.

---

## Canva

A API de Canva permite criação programática de designs a partir de templates. Caso de uso: o agente gera o copy do post → Canva API preenche o template visual → retorna URL do asset gerado. Ainda limitado em automação real (2025), mas vale monitorar. Implementar só quando a API estiver madura.

---

## Estrutura de repositório

```
/
  Makefile
  docker-compose.yml    — dev local (Postgres, MinIO para R2 mock)
  .mcp.json
  api/                  — Go
  ui/                   — SvelteKit
  ml/                   — Python (opcional)
  db/
    migrations/         — SQL (golang-migrate)
  infra/
    Dockerfile.api
    Dockerfile.ui
    terraform/          — infra prod (opcional)
```

---

## Migração do projeto atual

1. Manter SvelteKit UI intacta — só remover `+page.server.ts` e migrar para `fetch()`
2. Go API replica os endpoints que existem em `src/routes/api/`
3. Schema Postgres = SQLite atual + extensões (tsvector, vector, JSONB)
4. MCP tools T09 migram 1:1 para Go
5. Scripts (`collect-daily-metrics`, `deploy-google-ads`) viram workers Go
6. Python: adicionar quando tiver caso de uso concreto

---

## O que NÃO fazer prematuramente

- Multi-tenancy público (auth/RBAC completo) — só se virar SaaS
- Canva API — aguardar maturidade
- Python/RAG — só após volume de conteúdo justificar
- Kubernetes — Docker Compose resolve pra escala de produto solo/pequena equipe
