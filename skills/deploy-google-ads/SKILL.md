---
name: deploy-google-ads
description: Deploys an approved Google Ads campaign from a local JSON draft to the live Google Ads API. Creates Campaign Budget, Campaign, Ad Groups, Keywords, and RSAs — all as PAUSED for review before enabling.
---
# Deploy Google Ads Campaign

When the user asks to deploy, launch, or push a Google Ads campaign:

1. Identify the `client_id` and the campaign JSON filename.
2. Verify the campaign status is `approved` in `clients/<client_id>/ads/google/<filename>.json`. Stop if not.
3. Read `clients/<client_id>/brand.json` and verify:
   - `google_ads_id` is set (Google Ads Customer ID).
   - `website_url` is set (required as `final_url` for ads). Ask the user for it if missing.
4. Inform the user what will be deployed: campaign ID, number of ad groups, budget string.
5. Run the deploy script from the project root:
   ```bash
   bun scripts/deploy-google-ads.ts clients/<client_id>/ads/google/<filename>.json
   ```
6. Report the output to the user. On success, the local JSON status is automatically updated to `published`.
7. Remind the user: all assets are created as **PAUSED** in Google Ads — they must manually enable the campaign after review.
