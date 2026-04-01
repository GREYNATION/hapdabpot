import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const dbPath = process.env.DB_PATH || "./data/gravity-claw.db";
const dbDir = path.dirname(dbPath);

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL for better performance
db.pragma("journal_mode = WAL");

/**
 * Initialize the database schema
 */
export function initDb() {
    console.log("[db] Initializing database at:", dbPath);

    // 1. Core conversations table
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,          -- 'user' or 'assistant'
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. FTS5 Virtual Table for searching content
    db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            content,
            content='messages',
            content_rowid='id'
        );
    `);

    // 3. Triggers to keep FTS in sync with the messages table
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
            INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
        END;

        CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
            INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
        END;
    `);

    // 4. Settings table for chat-specific preferences
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            chat_id INTEGER PRIMARY KEY,
            voice_mode INTEGER DEFAULT 0
        );
    `);
    
    // 5. CRM Deals table
    db.exec(`
        CREATE TABLE IF NOT EXISTS deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL,
            seller_name TEXT,
            seller_phone TEXT,
            arv REAL DEFAULT 0,
            repair_estimate REAL DEFAULT 0,
            max_offer REAL DEFAULT 0,
            status TEXT DEFAULT 'lead', -- 'lead', 'contacted', 'offer sent', 'contract', 'closed'
            assigned_buyer TEXT,
            profit REAL DEFAULT 0,
            invoice_prompted INTEGER DEFAULT 0,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Migration for existing databases: check if invoice_prompted exists
    try {
        db.prepare("SELECT invoice_prompted FROM deals LIMIT 1").get();
    } catch (e) {
        console.log("[db] Adding invoice_prompted column to deals table...");
        db.exec("ALTER TABLE deals ADD COLUMN invoice_prompted INTEGER DEFAULT 0;");
    }

    try {
        db.prepare("SELECT notes FROM deals LIMIT 1").get();
    } catch (e) {
        console.log("[db] Adding notes column to deals table...");
        db.exec("ALTER TABLE deals ADD COLUMN notes TEXT;");
    }

    // 6. Buyers table
    db.exec(`
        CREATE TABLE IF NOT EXISTS buyers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            criteria TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 7. Background Queue table
    db.exec(`
        CREATE TABLE IF NOT EXISTS background_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            user_text TEXT,
            visual_context TEXT,
            is_voice_input INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
            retry_count INTEGER DEFAULT 0,
            last_error TEXT,
            response_text TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            processed_at DATETIME
        );
    `);

    // 8. Tasks table for persistent agent task tracking
    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            agent TEXT,
            task TEXT,
            status TEXT,
            result TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 9. Lead Alerts table
    db.exec(`
        CREATE TABLE IF NOT EXISTS scraped_leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL,
            source TEXT,
            price REAL,
            estimated_arv REAL,
            estimated_repairs REAL,
            mao REAL,
            potential_profit REAL,
            days_on_market INTEGER,
            motivation_signals TEXT,
            url TEXT,
            alerted INTEGER DEFAULT 0,
            deal_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 10. Search Criteria table
    db.exec(`
        CREATE TABLE IF NOT EXISTS lead_search_criteria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            city TEXT,
            state TEXT,
            zip TEXT,
            max_price REAL DEFAULT 150000,
            min_arv REAL DEFAULT 100000,
            max_dom INTEGER DEFAULT 90,
            min_profit REAL DEFAULT 10000,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Seed default search criteria if empty
    const existing = db.prepare("SELECT COUNT(*) as count FROM lead_search_criteria").get() as any;
    if (existing.count === 0) {
        db.prepare(`
            INSERT INTO lead_search_criteria (label, city, state, zip, max_price, min_arv, max_dom, min_profit)
            VALUES 
            ('South Jersey', 'Camden', 'NJ', null, 120000, 100000, 90, 10000),
            ('Brooklyn Wholesale', 'Brooklyn', 'NY', null, 400000, 350000, 60, 20000),
            ('Philadelphia', 'Philadelphia', 'PA', null, 100000, 90000, 90, 10000)
        `).run();
        console.log("[leads] Default search criteria seeded.");
    }

    // 11. Outreach Sequences (for multi-day follow-ups)
    db.exec(`
        CREATE TABLE IF NOT EXISTS outreach_sequences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending', -- 'pending', 'active', 'completed', 'stopped'
            current_step INTEGER DEFAULT 0,
            next_run_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 12. Outreach Logs
    db.exec(`
        CREATE TABLE IF NOT EXISTS outreach_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL,
            type TEXT, -- 'sms', 'email'
            content TEXT,
            status TEXT, -- 'sent', 'failed'
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log("[db] Database initialization complete.");
}

/**
 * Save a message to the database
 */
export function saveMessage(chatId: number, role: "user" | "assistant", content: string) {
    const stmt = db.prepare("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)");
    return stmt.run(chatId, role, content);
}

/**
 * Perform FTS search
 */
export function searchMessages(query: string, limit = 5) {
    const sanitized = query.replace(/[^\p{L}\p{N} ]/gu, " ").trim();
    if (!sanitized) return [];
    const safeQuery = sanitized.split(/\s+/).filter(w => w.length > 2).join(" OR ");
    if (!safeQuery) return [];
    const stmt = db.prepare(`
        SELECT m.* FROM messages m
        JOIN messages_fts f ON m.id = f.rowid
        WHERE messages_fts MATCH ?
        ORDER BY rank
        LIMIT ?
    `);
    return stmt.all(safeQuery, limit);
}

/**
 * Get the most recent messages for a chat
 */
export function getRecentMessages(chatId: number, limit = 10) {
    const stmt = db.prepare(`
        SELECT role, content FROM (
            SELECT role, content, id FROM messages 
            WHERE chat_id = ? 
            ORDER BY id DESC 
            LIMIT ?
        ) ORDER BY id ASC
    `);
    const results = stmt.all(chatId, limit) as { role: string, content: string }[];
    return results.map(r => ({
        role: r.role as "user" | "assistant",
        content: r.content
    }));
}

export function addToQueue(chatId: number, text: string, context: any, isVoice: boolean) {
    const stmt = db.prepare(`
        INSERT INTO background_queue (chat_id, user_text, visual_context, is_voice_input)
        VALUES (?, ?, ?, ?)
    `);
    return stmt.run(chatId, text, JSON.stringify(context), isVoice ? 1 : 0);
}

export function getNextPendingTask() {
    const stmt = db.prepare(`
        SELECT * FROM background_queue 
        WHERE status = 'pending' AND processed_at IS NULL
        ORDER BY created_at ASC 
        LIMIT 1
    `);
    return stmt.get() as any;
}

export function markTaskAsProcessing(id: number) {
    const stmt = db.prepare("UPDATE background_queue SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    return stmt.run(id);
}

export function markTaskAsCompleted(id: number, responseText: string) {
    const stmt = db.prepare(`
        UPDATE background_queue 
        SET status = 'completed', response_text = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `);
    return stmt.run(responseText, id);
}

export function updateTaskRetry(id: number, error: string) {
    const stmt = db.prepare(`
        UPDATE background_queue 
        SET retry_count = retry_count + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP, status = 'pending'
        WHERE id = ?
    `);
    return stmt.run(error, id);
}

export function markTaskAsFailed(id: number, error: string) {
    const stmt = db.prepare(`
        UPDATE background_queue 
        SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `);
    return stmt.run(error, id);
}

