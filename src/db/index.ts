import Database from 'better-sqlite3';
import { initLeadsTable } from './leads.js';
import { initContentTable } from './content.js';

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    db = new Database('hermes.db');
    // Initialize tables
    initLeadsTable(db);
    initContentTable(db);
  }
  return db;
}
