import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "local_storage.db");

/**
 * SQLite Database Connection Test
 * Using better-sqlite3 for high performance local storage
 */
async function runDatabaseTest() {
    console.log(`[database] Connecting to: ${DB_PATH}`);

    try {
        // 1. Initialize Database
        const db = new Database(DB_PATH, { verbose: console.log });
        
        // 2. Enable WAL mode for high concurrency performance
        db.pragma("journal_mode = WAL");
        console.log("[database] WAL mode enabled");

        // 3. Create Sample Table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS local_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE,
                value TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        console.log("[database] Table 'local_cache' ready");

        // 4. Insert Sample Record
        const insert = db.prepare("INSERT OR REPLACE INTO local_cache (key, value) VALUES (?, ?)");
        const testKey = "system_status";
        const testValue = "Master Brain SQLite Online";
        
        insert.run(testKey, testValue);
        console.log(`[database] Inserted test record: ${testKey} -> ${testValue}`);

        // 5. Retrieve and Verify
        const row = db.prepare("SELECT * FROM local_cache WHERE key = ?").get(testKey) as any;
        
        if (row && row.value === testValue) {
            console.log("✅ [database] Connection Verified: Data round-trip successful!");
            console.log(`[database] Record result: ID=${row.id}, Created=${row.created_at}`);
        } else {
            throw new Error("Data retrieval mismatch");
        }

        // 6. Cleanup (Optional: keep open if long-running process)
        db.close();
        console.log("[database] Connection closed cleanly");

    } catch (err: unknown) {
        console.error("❌ [database] Test failed:", err);
    }
}

// Execute
runDatabaseTest();
