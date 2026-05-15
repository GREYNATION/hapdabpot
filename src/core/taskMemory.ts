import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = path.resolve("./data/tasks.db");
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize Tables
db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        goal TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        plan_id TEXT,
        agent TEXT,
        task TEXT,
        depends_on TEXT, -- JSON array of task IDs
        status TEXT,
        result TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(plan_id) REFERENCES plans(id)
    );
`);

// Migration: Add error column if missing
try {
    db.prepare("SELECT error FROM tasks LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE tasks ADD COLUMN error TEXT");
}

// --- PLAN OPERATIONS ---

export function savePlan(plan: { id: string, goal: string, status: string }) {
    const stmt = db.prepare(`
        INSERT INTO plans (id, goal, status)
        VALUES (?, ?, ?)
    `);
    stmt.run(plan.id, plan.goal, plan.status);
}

export function updatePlanStatus(id: string, status: string) {
    const stmt = db.prepare(`UPDATE plans SET status = ? WHERE id = ?`);
    stmt.run(status, id);
}

export function getPlan(id: string) {
    return db.prepare(`SELECT * FROM plans WHERE id = ?`).get(id);
}

// --- TASK OPERATIONS ---

export function saveTask(task: { id: string, plan_id: string, agent: string, task: string, status: string, depends_on?: string[] }) {
    const stmt = db.prepare(`
        INSERT INTO tasks (id, plan_id, agent, task, status, depends_on)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        task.id, 
        task.plan_id, 
        task.agent, 
        task.task, 
        task.status, 
        JSON.stringify(task.depends_on || [])
    );
}

export function updateTaskInDB(id: string, status: string, result?: string, error?: string) {
    const stmt = db.prepare(`
        UPDATE tasks
        SET status = ?, result = ?, error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    stmt.run(status, result || null, error || null, id);
}

export function getTasksForPlan(planId: string) {
    const rows: any[] = db.prepare(`SELECT * FROM tasks WHERE plan_id = ?`).all();
    return rows.map(r => ({
        ...r,
        dependsOn: JSON.parse(r.depends_on || "[]")
    }));
}

export function getTask(id: string) {
    const row: any = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
    if (!row) return null;
    return {
        ...row,
        dependsOn: JSON.parse(row.depends_on || "[]")
    };
}

export function getTasks() {
    return db.prepare(`SELECT * FROM tasks ORDER BY created_at DESC`).all();
}

export function getPlans(limit = 50) {
    return db.prepare(`SELECT * FROM plans ORDER BY created_at DESC LIMIT ?`).all(limit);
}
