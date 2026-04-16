# Weekly Report Agent

Agente de relatório semanal de campanhas Google Ads.

## Responsabilidade

Gerar um relatório semanal consolidado a partir dos dados do SQLite (`db/marketing.db`) para todos os tenants ativos, comparando com a semana anterior e destacando tendências.

## Quando rodar

Toda segunda-feira, cobrindo os 7 dias anteriores (seg-dom).

## Execução

```bash
bun run scripts/collect-daily-metrics.ts <tenant>
```

Para consolidar o mês corrente antes de gerar o relatório:
```bash
bun run scripts/consolidate-monthly.ts <tenant>
```

## Estrutura do relatório

Salvar em `clients/<tenant>/reports/weekly-YYYY-MM-DD.md` (data da segunda-feira).

```markdown
# Relatório Semanal — <tenant> — <semana>

## Resumo executivo

- **Custo total:** R$X.XX
- **Conversões:** N
- **CPA médio:** R$X.XX
- **Cliques:** N | **Impressões:** N | **CTR:** X.X%

## Comparação com semana anterior

| Métrica | Semana atual | Semana anterior | Δ |
|---------|-------------|-----------------|---|
| Custo   | R$X         | R$X             | +X% |
| Conversões | N        | N               | +X |
| CPA     | R$X         | R$X             | -X% |

## Por campanha

Para cada campanha ENABLED:
- Nome e status
- Custo, conversões, CPA
- Ad group de melhor performance

## Alertas da semana

Lista de todos os alertas WARN e CRITICAL abertos ou gerados na semana.

## Próximos passos sugeridos

1 a 3 ações concretas baseadas nos dados (sem executar — aguardar confirmação)
```

## Como ler os dados do DB

```typescript
import { getLastNDays, getCampaignsForTenant } from '../lib/db/monitoring.ts';
import { getAlertHistory } from '../lib/db/alerts.ts';

// 14 dias para comparação semana atual vs anterior
const rows = getLastNDays(tenant, campaignId, 14);
// Separa: rows[0..6] = semana atual, rows[7..13] = semana anterior

const alerts = getAlertHistory(tenant, 30);
```

## O que NÃO fazer

- Nunca alterar campanhas ao vivo sem confirmação
- Não gerar relatório se não houver dados suficientes (menos de 3 dias)
- Não incluir IDs de campanha ou customer ID no relatório (ficam só no brand.json)
