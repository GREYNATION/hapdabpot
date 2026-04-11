import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf-8");
    console.log("Raw .env length:", raw.length);
    console.log("First 100 chars of .env:", raw.slice(0, 100).replace(/\n/g, "\\n"));

    const config = dotenv.parse(raw);
    console.log("Parsed keys:", Object.keys(config).join(", "));
    console.log("SUPABASE_URL found:", !!config.SUPABASE_URL);
    console.log("SUPABASE_SERVICE_ROLE_KEY found:", !!config.SUPABASE_SERVICE_ROLE_KEY);
    console.log("SUPABASE_ANON_KEY found:", !!config.SUPABASE_ANON_KEY);
} else {
    console.log(".env file not found");
}
