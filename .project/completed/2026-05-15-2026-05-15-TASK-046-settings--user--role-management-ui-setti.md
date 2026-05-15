---
title: "Settings — User & Role Management UI (/settings/users + /settings/roles)"
created: 2026-05-15T02:35:08.589Z
priority: P1-L
status: backlog
tags: [feat]
---

# Settings — User & Role Management UI (/settings/users + /settings/roles)

# TASK-046 — Settings: User & Role Management UI

## Objetivo

Criar as páginas `/[tenant]/settings/users` e `/[tenant]/settings/roles` para que owners e managers possam gerenciar usuários e permissões do tenant sem precisar de acesso de superadmin.

---

## Contexto técnico

### Já existe no backend

- `AdminUsersHandler` em `internal/api/admin_users.go`: `List`, `Get`, `Create`, `Update`, `Delete`, `AssignRole`
- `AdminRolesHandler` em `internal/api/admin_roles.go`: provavelmente `List` de roles
- `RBACRepository` em `internal/repository/rbac.go`
- Rotas montadas em `cmd/server/main.go` dentro do subrouter `tenants/{tenantId}`
- Permissões relevantes: `view-any:user`, `manage:user`

### O que falta no backend

Verificar se as rotas abaixo existem; criar as que faltarem:

1. `GET /admin/tenants/{tenantId}/users` — lista usuários do tenant com role atual
2. `GET /admin/tenants/{tenantId}/roles` — lista roles disponíveis com suas permissions
3. `GET /admin/tenants/{tenantId}/permissions` — lista todas as permissions do sistema
4. `PUT /admin/tenants/{tenantId}/users/{userId}/role` — já existe via `AssignRole`
5. `POST /admin/tenants/{tenantId}/users` — cria usuário já vinculado ao tenant
6. `DELETE /admin/tenants/{tenantId}/users/{userId}` — remove usuário do tenant (soft: desativa + remove vínculo)
7. `PATCH /admin/tenants/{tenantId}/users/{userId}` — atualiza nome/email/status do usuário

Todas as rotas de leitura requerem `view-any:user`, mutações requerem `manage:user`.

---

## Fase 1 — Auditoria e ajuste do backend

### 1a. Verificar rotas existentes em `main.go`

Dentro do bloco `tenants/{tenantId}`, confirmar se existem:
```
GET    /users             → list users in tenant
GET    /users/{userId}    → get single user
POST   /users             → create + assign to tenant
PATCH  /users/{userId}    → update user (name/email/locale/active)
DELETE /users/{userId}    → deactivate + remove from tenant
PUT    /users/{userId}/role → assign role
GET    /roles             → list roles with permissions
GET    /permissions       → list all permissions
```

### 1b. Criar rotas/handlers faltantes

**`GET /admin/tenants/{tenantId}/users`** deve retornar:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "locale": "string",
      "is_active": true,
      "role": { "id": "role_owner", "name": "Owner" },
      "created_at": "ISO8601"
    }
  ]
}
```

**`GET /admin/tenants/{tenantId}/roles`** deve retornar:
```json
{
  "data": [
    {
      "id": "role_owner",
      "name": "Owner",
      "permissions": ["manage:user", "view-any:user", "view:integrations", ...]
    }
  ]
}
```

**`GET /admin/tenants/{tenantId}/permissions`** deve retornar lista flat de todas as permissions registradas na tabela `permissions`.

### 1c. `POST /admin/tenants/{tenantId}/users`

Body:
```json
{
  "name": "string",
  "email": "string",
  "password": "string",    // mínimo 8 chars
  "role_id": "role_content_creator",
  "locale": "pt-BR",
  "timezone": "America/Sao_Paulo"
}
```

Fluxo:
1. Criar usuário na tabela `users`
2. Fazer INSERT em `user_roles` vinculando ao tenant com o role_id
3. Auditar (`user.created` + `user.role_assigned`)
4. Retornar usuário criado com role

Conflito de email → 409.

### 1d. `DELETE /admin/tenants/{tenantId}/users/{userId}`

- Não deletar o registro — setar `is_active = false`
- Remover vínculo `user_roles` para este tenant
- Auditar `user.deactivated`
- Retornar 204

### 1e. Adicionar `PATCH /admin/tenants/{tenantId}/users/{userId}`

Body parcial (todos opcionais):
```json
{ "name": "string", "email": "string", "locale": "string", "is_active": boolean }
```

Auditar `user.updated`.

---

## Fase 2 — Frontend: `/[tenant]/settings/users`

### Layout

Adicionar 2 novos itens no `+layout.svelte` de settings:
```
General | Google Ads | Audit Log | Users | Roles
                                   ^^^^   ^^^^^  (novos)
```

Ícone `Users` (lucide) para Users, `ShieldCheck` para Roles.

Guardar os dois links com `hasPermission('view-any:user')` — esconder se sem permissão.

### `+page.ts` (load)

```ts
export const load = async ({ fetch, params }) => {
  const [usersRes, rolesRes] = await Promise.all([
    fetch(`/admin/tenants/${params.tenant}/users`),
    fetch(`/admin/tenants/${params.tenant}/roles`),
  ])
  return {
    users: (await usersRes.json()).data ?? [],
    roles: (await rolesRes.json()).data ?? [],
  }
}
```

### `+page.svelte` — estrutura

**Header:**
- Título "Team Members" com contagem `(N)`
- Botão "+ Invite User" (abre modal, visível só com `manage:user`)

**Tabela de usuários:**

| Avatar+Name | Email | Role (dropdown) | Status (badge) | Actions |
|-------------|-------|-----------------|----------------|---------|

- Avatar: iniciais do nome em círculo colorido (hash do id → cor)
- Role: `<select>` com todos os roles disponíveis; `onchange` → `PUT /role` imediatamente + toast "Role updated"
- Status badge: `Active` (verde) / `Inactive` (cinza)
- Actions: botão de desativar (ícone `UserX`) com confirm dialog; visível só com `manage:user`
- Linha do próprio usuário logado: role e actions desabilitados (não pode se auto-editar)

**Estado vazio:** mensagem "No team members found."

**Skeleton loading:** 5 linhas placeholder durante load.

### Modal "Invite User"

Campos:
- Name (required)
- Email (required, type=email)
- Password (required, min 8 chars, com toggle show/hide)
- Role (select, default: `role_content_creator`)
- Locale (select: pt-BR / en-US)

Submit → `POST /admin/tenants/{tenant}/users`
- Success: fechar modal, inserir novo usuário na lista, toast "User invited"
- 409: mostrar "Email already in use"
- Erro genérico: toast de erro

---

## Fase 3 — Frontend: `/[tenant]/settings/roles`

### `+page.ts` (load)

```ts
export const load = async ({ fetch, params }) => {
  const [rolesRes, permsRes] = await Promise.all([
    fetch(`/admin/tenants/${params.tenant}/roles`),
    fetch(`/admin/tenants/${params.tenant}/permissions`),
  ])
  return {
    roles: (await rolesRes.json()).data ?? [],
    allPermissions: (await permsRes.json()).data ?? [],
  }
}
```

### `+page.svelte` — estrutura

**Dois painéis side-by-side** (lg:grid-cols-[280px_1fr]):

**Painel esquerdo — lista de roles:**
- Card por role (clicável, highlight quando selecionado)
- Nome do role + quantidade de permissões
- Roles do sistema: Owner, Manager, Content Creator, Content Approver, Scheduler, Client Viewer

**Painel direito — detalhe do role selecionado:**
- Título do role + descrição (hardcoded por role_id)
- Lista de permissões agrupadas por categoria:

```
Content
  ✅ create:post
  ✅ review:post
  ✅ approve:post   (só approver+)
  ✅ schedule:post  (só scheduler+)
  ✅ publish:post   (só manager+)

Advertising
  ✅ view:campaign
  ✅ view:report

Users & Access
  ✅ view-any:user  (só manager+)
  ✅ manage:user    (só owner)

Integrations
  ✅ view:integrations (só owner+manager)
  ✅ manage:integrations (só owner)
```

- Permissões que o role TEM: check verde (`✅`)
- Permissões que NÃO TEM: `—` cinza
- **Read-only** nesta fase (roles são do sistema, não customizáveis ainda)
- Badge "System Role" em todos

**Nota de rodapé:** "Custom roles coming soon."

---

## Fase 4 — i18n

Adicionar em `locales/en/settings.json` e `locales/pt-BR/settings.json`:

```json
// EN
"nav_users": "Users",
"nav_roles": "Roles",
"users_title": "Team Members",
"users_invite": "Invite User",
"users_col_name": "Name",
"users_col_email": "Email",
"users_col_role": "Role",
"users_col_status": "Status",
"users_status_active": "Active",
"users_status_inactive": "Inactive",
"users_empty": "No team members found.",
"users_deactivate_confirm": "Deactivate {name}? They will lose access immediately.",
"users_deactivate_confirm_btn": "Deactivate",
"users_invite_title": "Invite User",
"users_invite_field_name": "Full name",
"users_invite_field_email": "Email",
"users_invite_field_password": "Password",
"users_invite_field_role": "Role",
"users_invite_field_locale": "Language",
"users_invite_submit": "Send Invite",
"users_toast_role_updated": "Role updated",
"users_toast_invited": "User invited",
"users_toast_deactivated": "User deactivated",
"users_error_email_taken": "Email already in use",
"roles_title": "Roles & Permissions",
"roles_system_badge": "System Role",
"roles_coming_soon": "Custom roles coming soon.",
"roles_perm_group_content": "Content",
"roles_perm_group_advertising": "Advertising",
"roles_perm_group_users": "Users & Access",
"roles_perm_group_integrations": "Integrations"

// PT-BR equivalentes
```

---

## Fase 5 — RBAC no frontend

Importar `userStore` ou `$page.data.user` para verificar permissões antes de renderizar elementos de mutação:

```ts
const canManage = $derived(user?.permissions?.includes('manage:user') ?? false)
```

- Botão "Invite User": renderiza só se `canManage`
- Dropdown de role na tabela: `disabled` se `!canManage`
- Botão de desativar: renderiza só se `canManage`
- Página `/settings/roles`: sempre acessível para quem tem `view-any:user` (read-only)

---

## Critérios de aceite (DoD)

- [ ] `GET /admin/tenants/{tenantId}/users` retorna lista com role por usuário
- [ ] `GET /admin/tenants/{tenantId}/roles` retorna roles com permissions
- [ ] `GET /admin/tenants/{tenantId}/permissions` retorna todas as permissions
- [ ] `POST /admin/tenants/{tenantId}/users` cria usuário + vínculo + audit
- [ ] `DELETE /admin/tenants/{tenantId}/users/{userId}` desativa + audit
- [ ] `PUT /admin/tenants/{tenantId}/users/{userId}/role` já funciona (verificar)
- [ ] `/settings/users` lista membros com role dropdown funcional
- [ ] Modal de invite funciona (create + 409 + erro)
- [ ] Desativar usuário com confirm dialog funciona
- [ ] `/settings/roles` exibe todos os roles com permissões agrupadas
- [ ] Nav de settings mostra Users e Roles (com guard de permissão)
- [ ] i18n completo em EN e PT-BR
- [ ] Owner não aparece como editável para si mesmo
- [ ] `go build ./...` e `bun run build` passam sem erros

