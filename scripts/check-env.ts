import 'dotenv/config';

console.log("Checking environment variables...\n");

console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "✅ Set" : "❌ Not set");
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Not set");
console.log("SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "✅ Set" : "❌ Not set");
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Not set");

if (process.env.SUPABASE_URL) {
  console.log("\nSUPABASE_URL value:", process.env.SUPABASE_URL);
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("\nSUPABASE_SERVICE_ROLE_KEY (first 50 chars):", process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 50) + "...");
}