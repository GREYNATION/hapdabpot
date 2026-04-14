import Database from 'better-sqlite3';

// ─── STUYZA LEADS ────────────────────────────────────────────────────────────

export function initLeadsTable(db: Database.Database) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS stuyza_leads (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      fname      TEXT NOT NULL,
      lname      TEXT,
      email      TEXT NOT NULL,
      phone      TEXT,
      biz_type   TEXT,
      service    TEXT,
      notes      TEXT,
      source     TEXT DEFAULT 'landing_page',
      status     TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export function insertStuyzaLead(db: Database.Database, lead: {
  fname: string;
  lname?: string;
  email: string;
  phone?: string;
  biz_type?: string;
  service?: string;
  notes?: string;
  source?: string;
}) {
  return db.prepare(`
    INSERT INTO stuyza_leads (fname, lname, email, phone, biz_type, service, notes, source)
    VALUES (@fname, @lname, @email, @phone, @biz_type, @service, @notes, @source)
  `).run(lead);
}

export function getStuyzaLeads(db: Database.Database, limit = 20) {
  return db.prepare(`
    SELECT * FROM stuyza_leads ORDER BY created_at DESC LIMIT ?
  `).all(limit);
}

export function getStuyzaLeadById(db: Database.Database, id: number) {
  return db.prepare(`SELECT * FROM stuyza_leads WHERE id = ?`).get(id);
}

export function getStuyzaLeadStats(db: Database.Database) {
  return db.prepare(`
    SELECT
      COUNT(*)                                        AS total,
      IFNULL(SUM(CASE WHEN status = 'new'      THEN 1 END), 0) AS new_leads,
      IFNULL(SUM(CASE WHEN status = 'booked'   THEN 1 END), 0) AS booked,
      IFNULL(SUM(CASE WHEN status = 'closed'   THEN 1 END), 0) AS closed
    FROM stuyza_leads
  `).get() as { total: number; new_leads: number; booked: number; closed: number };
}

export function updateStuyzaLeadStatus(db: Database.Database, id: number, status: string) {
  db.prepare(`UPDATE stuyza_leads SET status = ? WHERE id = ?`).run(status, id);
}
