---
name: list-google-ads-campaigns
description: Lists active Google Ads campaigns for a specific client. Use this to check live campaigns, their status, impressions, and cost directly from the Google Ads API.
---
# List Google Ads Campaigns

When the user asks to see or list the Google Ads campaigns for a client:

1. Identify the client and read `clients/<client_id>/brand.json` to extract `google_ads_id`.
2. Navigate to the `ui` directory and use the `run_shell_command` to execute a script that imports `getLiveCampaigns` from `src/lib/server/googleAds.ts`.
3. Example script to run via `bun run` in the `ui` folder:
   ```bash
   cat << 'EOF' > test-list.ts
   import { getLiveCampaigns } from './src/lib/server/googleAds.js';
   async function run() {
       try {
           const res = await getLiveCampaigns('GOOGLE_ADS_ID');
           console.log(JSON.stringify(res, null, 2));
       } catch (e) { console.error(e); }
   }
   run();
   EOF
   bun run test-list.ts
   rm test-list.ts
   ```
4. Parse the output and summarize the live campaigns back to the user cleanly.