import { GoogleAdsApi } from 'google-ads-api';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new GoogleAdsApi({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    });

    const customer = client.Customer({
        customer_id: 'CUSTOMER_ID_REDACTED',
        login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!.replace(/-/g, ''),
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!
    });

    try {
        const res = await customer.query(`
            SELECT 
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value
            FROM campaign
            WHERE campaign.id = CAMPAIGN_ID_REDACTED AND segments.date DURING LAST_30_DAYS
            ORDER BY segments.date ASC
        `);
        console.log(res);
    } catch (e: any) {
        console.error(e.message || e);
        if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
    }
}
run();