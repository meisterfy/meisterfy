---
title: "ADR-005: Connector Resources Unification"
date: 2026-04-30
status: Accepted
---

# ADR-005: Connector Resources Unification

## Rationale

After implementing the Meta Connector (TASK-025) with a dedicated `meta_accounts` table, we realized the same pattern was needed for Google Ads (customer_id currently lives in `tenants.google_ads_id`) and will be needed for R2/S3 (buckets), TikTok, LinkedIn, etc.

The key insight is that `integrations` represents **shared connections** (credentials/config) that can be linked to multiple tenants via `integration_tenants`. Each tenant then has its own **discovered resources** (pages, ad accounts, buckets) accessible through one or more of these connections.

This creates a clean separation:
- **integrations** = who can connect to which API (with what credentials)
- **connector_resources** = what actual accounts/pages/buckets each tenant has access to

The `integration_id` FK in `connector_resources` is critical — it tells us which connection to use when operating on that resource. A tenant may have Meta pages via their own integration, and Google Ads accounts via the agency's shared integration.

This replaces:
- `meta_accounts` (dedicated table)
- `tenants.google_ads_id` (loose column)
- Any future dedicated tables per connector

With a single generic table: `connector_resources`.

## Status

Accepted
