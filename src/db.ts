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
    // Note: External content FTS5 is often preferred for large DBs, 
    // but for this bot, a simple managed FTS table is cleaner.
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

    // 5. Tasks table for persistent agent task tracking
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

    // 6. Stuyza Agency Leads table
    db.exec(`
        CREATE TABLE IF NOT EXISTS stuyza_leads (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            fname       TEXT NOT NULL,
            lname       TEXT,
            email       TEXT NOT NULL,
            phone       TEXT,
            biz_type    TEXT,
            service     TEXT,
            notes       TEXT,
            source      TEXT DEFAULT 'landing_page',
            status      TEXT DEFAULT 'new',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
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
    // Sanitize query: keep only alphanumeric characters and spaces to prevent FTS5 syntax errors
    const sanitized = query.replace(/[^\p{L}\p{N} ]/gu, " ").trim();
    if (!sanitized) return [];

    // Construct a safe "OR" query from words longer than 2 characters
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
/**
 * Get voice mode for a chat
 */
export function getVoiceMode(chatId: number): boolean {
    const stmt = db.prepare("SELECT voice_mode FROM settings WHERE chat_id = ?");
    const result = stmt.get(chatId) as { voice_mode: number } | undefined;
    return result ? result.voice_mode === 1 : false;
}

/**
 * Set voice mode for a chat
 */
export function setVoiceMode(chatId: number, mode: boolean) {
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (chat_id, voice_mode) VALUES (?, ?)");
    return stmt.run(chatId, mode ? 1 : 0);
}

/**
 * Stuyza Leads Helpers
 */
export function insertStuyzaLead(lead: {
    fname: string;
    lname?: string;
    email: string;
    phone?: string;
    biz_type?: string;
    service?: string;
    notes?: string;
    source?: string;
}) {
    const stmt = db.prepare(`
        INSERT INTO stuyza_leads (fname, lname, email, phone, biz_type, service, notes, source)
        VALUES (@fname, @lname, @email, @phone, @biz_type, @service, @notes, @source)
    `);
    return stmt.run(lead);
}

export function getStuyzaLeads(limit = 20) {
    return db.prepare(`
        SELECT * FROM stuyza_leads
        ORDER BY created_at DESC
        LIMIT ?
    `).all(limit);
}

export function updateStuyzaLeadStatus(id: number, status: string) {
    db.prepare(`UPDATE stuyza_leads SET status = ? WHERE id = ?`).run(status, id);
}

export function getStuyzaLeadStats() {
    return db.prepare(`
        SELECT
            COUNT(*)                                         AS total,
            SUM(CASE WHEN status = 'new'      THEN 1 END)   AS new_leads,
            SUM(CASE WHEN status = 'booked'   THEN 1 END)   AS booked,
            SUM(CASE WHEN status = 'closed'   THEN 1 END)   AS closed
        FROM stuyza_leads
    `).get() as { total: number; new_leads: number; booked: number; closed: number };
}
