---
name: optimize-roas
description: Analyzes a live Google Ads campaign and proposes pausing underperforming Ad Groups based on CPA/ROAS thresholds. Executes mutations after user confirmation.
---
# Optimize ROAS

When the user asks to optimize ROAS, fix a bleeding campaign, or pause underperforming ad groups:

1. Identify the `client_id` and `campaign_id` (the Google Ads numeric campaign ID).
2. Fetch the live detailed report using the `get-google-ads-campaign` skill workflow (run `getDetailedCampaign` via a temp Bun script in `ui/`).
3. Analyze the Ad Groups:
   - **High Performers:** Conversions > 0 AND ROAS > 200% (or CPA within the client's acceptable range).
   - **Bleeding:** Cost > threshold (e.g., 3× acceptable CPA) AND Conversions = 0.
4. Present findings to the user:
   - "Ad Group X: R$120 spent, 0 conversions. Ad Group Y: ROAS 340%."
   - Clearly state which ad groups you propose to PAUSE and why.
5. Wait for user confirmation before making any changes.
6. Once confirmed, create a temp script `ui/pause-adgroups.ts`:
   ```typescript
   import { GoogleAdsApi, enums } from 'google-ads-api';
   import dotenv from 'dotenv';
   import path from 'node:path';
   dotenv.config({ path: path.resolve('../.env') });

   const client = new GoogleAdsApi({ /* credentials from env */ });
   const customer = client.Customer({ /* ... */ });

   await customer.adGroups.update([
     { resource_name: 'customers/<customerId>/adGroups/<adGroupId>', status: enums.AdGroupStatus.PAUSED }
   ]);
   console.log('Ad group paused.');
   ```
7. Run `bun run ui/pause-adgroups.ts && rm ui/pause-adgroups.ts`.
8. Confirm to the user which ad groups were paused and recommend next steps (e.g., reallocate budget, test new copy).
