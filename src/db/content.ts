import Database from 'better-sqlite3';

export function initContentTable(db: Database.Database) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS generated_content (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      niche      TEXT NOT NULL,
      source_url TEXT,
      script     TEXT NOT NULL,
      hook       TEXT,
      status     TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export function insertGeneratedContent(db: Database.Database, data: {
  niche: string;
  source_url?: string;
  script: string;
  hook?: string;
}) {
  return db.prepare(`
    INSERT INTO generated_content (niche, source_url, script, hook)
    VALUES (@niche, @source_url, @script, @hook)
  `).run(data);
}

export function getGeneratedContent(db: Database.Database, limit = 10) {
  return db.prepare(`SELECT * FROM generated_content ORDER BY created_at DESC LIMIT ?`).all(limit);
}
