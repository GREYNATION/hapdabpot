import { createClient } from '@supabase/supabase-js';
import "dotenv/config";

async function storeCredential(key: string, value: string, service: string) {
    const url = process.env.SUPABASE_URL!;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, secret);

    const { error } = await supabase
        .from('hapda_credentials')
        .upsert({ key, value, service, updated_at: new Date().toISOString() });

    if (error) {
        console.error("Failed:", error);
        return;
    }
    console.log(`Stored: ${key} (${service})`);
}

const apiKey = process.argv[2];
if (!apiKey) {
    console.error("Usage: npx tsx store_glm_key.ts YOUR_API_KEY");
    process.exit(1);
}

storeCredential('GLM_API_KEY', apiKey, 'zhipu');
