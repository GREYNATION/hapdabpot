import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Use the project's standard data directory if possible, otherwise default to user's "data.db"
// Resolve path RELATIVE TO RUNTIME (important)
const dbPath = path.resolve("./data/tasks.db");
const dbDir = path.dirname(dbPath);

// Ensure directory exists
if (!fs.existsSync(dbDir)) {
    console.log('Creating DB directory:', dbDir);
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
console.log('Task DB connected at:', dbPath);
console.log('CWD:', process.cwd());

// Ensure the table exists in this specific DB if we are using a separate one
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

// CREATE
export function saveTask(task: any) {
  const stmt = db.prepare(`
    INSERT INTO tasks (id, agent, task, status, result)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(task.id, task.agent, task.task, task.status, task.result || null);
}

// UPDATE
export function updateTaskInDB(id: string, status: string, result?: string) {
  const stmt = db.prepare(`
    UPDATE tasks
    SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(status, result || null, id);
}

// GET ALL
export function getTasks() {
  return db.prepare(`SELECT * FROM tasks ORDER BY created_at DESC`).all();
}

export function getTask(id: string) {
    return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
}

