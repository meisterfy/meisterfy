# Security Policy

## Supported Versions

During the alpha period, only the latest commit on `main` receives security fixes.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via GitHub's [Security Advisories](../../security/advisories/new). We will respond within 72 hours and coordinate a fix and disclosure timeline with you.

Include in your report:
- A description of the vulnerability and its potential impact.
- Steps to reproduce or a proof-of-concept.
- Any suggested mitigations, if you have them.

## Scope

Areas of particular interest:

- **Authentication & session management** — JWT issuance, refresh, cookie handling.
- **Multi-tenancy isolation** — data leakage between tenants.
- **Credential storage** — encryption of OAuth tokens and API keys in the `integrations` table.
- **MCP API keys** — scope enforcement, key revocation.
- **OAuth flows** — Google Ads and Meta callback handling.
- **Media upload** — path traversal, file type validation.
- **AI generation endpoint** — prompt injection, SSE stream leakage.

## Out of Scope

- Vulnerabilities in third-party dependencies (report those upstream).
- Issues requiring physical access to the server.
- Social engineering attacks.
- Self-hosted instances with intentionally misconfigured environments.

## Disclosure Policy

We follow coordinated disclosure. Once a fix is ready and deployed, we will publish a security advisory crediting the reporter (unless anonymity is preferred).
