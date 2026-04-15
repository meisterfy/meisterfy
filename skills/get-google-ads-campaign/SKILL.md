---
name: get-google-ads-campaign
description: Gets detailed Google Ads campaign metrics (ROAS, clicks, costs, conversions, etc.) for a specific campaign ID and client.
---
# Get Google Ads Campaign Details

When the user asks for detailed metrics or a report for a specific campaign:

1. Identify the client and read `clients/<client_id>/brand.json` to extract `google_ads_id`.
2. Ensure you have the `campaign_id`.
3. Navigate to the `ui` directory and use the `write_file` tool to create a temporary script `test-detail.ts`:
   ```typescript
   import { getDetailedCampaign } from './src/lib/server/googleAdsDetailed.js';
   async function run() {
       try {
           const res = await getDetailedCampaign('GOOGLE_ADS_ID', 'CAMPAIGN_ID', 'START_DATE', 'END_DATE');
           console.log(JSON.stringify(res, null, 2));
       } catch (e) { console.error(e); }
   }
   run();
   ```
4. Use `run_shell_command` to run `bun run test-detail.ts && rm test-detail.ts`.
5. Read the JSON output and analyze the performance, identifying trends, ROAS, and Ad Groups metrics to provide strategic insights.