import { GoogleAdsApi } from 'google-ads-api';
import dotenv from 'dotenv';
dotenv.config();

async function testConnection() {
    try {
        const client = new GoogleAdsApi({
            client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
            client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
            developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        });

        const customer = client.Customer({
            customer_id: 'CUSTOMER_ID_REDACTED', // Pórtico ID (without hyphens)
            login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!.replace(/-/g, ''),
            refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!
        });

        console.log('🔄 Attempting to connect to Google Ads API...');
        
        // Make a simple query to verify authentication
        const campaigns = await customer.query(`
            SELECT campaign.id, campaign.name 
            FROM campaign 
            ORDER BY campaign.id 
            LIMIT 1
        `);

        console.log('✅ SUCCESS! Authenticated and connected to Google Ads API.');
        console.log(`📡 Found ${campaigns.length} campaigns (Test Query).`);
        
    } catch (error: any) {
        console.error('❌ CONNECTION FAILED:');
        console.error(error.message || error);
        if (error.errors) {
            console.error(JSON.stringify(error.errors, null, 2));
        }
    }
}

testConnection();