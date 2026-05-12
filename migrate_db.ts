import { getDb } from './src/core/memory.js';
import { log } from './src/core/config.js';

async function migrate() {
  const db = getDb();
  try {
    // Check if zip_codes column exists
    const tableInfo = db.prepare("PRAGMA table_info(lead_search_criteria)").all() as any[];
    const hasZipCodes = tableInfo.some(c => c.name === 'zip_codes');
    
    if (!hasZipCodes) {
      log("[migration] Adding zip_codes column to lead_search_criteria...");
      db.exec("ALTER TABLE lead_search_criteria ADD COLUMN zip_codes TEXT;");
    }

    // Clear old data and seed Cleveland if requested, or just ensure Cleveland exists
    const cleveland = db.prepare("SELECT * FROM lead_search_criteria WHERE label = 'Cleveland Gold Mine'").get();
    if (!cleveland) {
      log("[migration] Seeding Cleveland Gold Mine...");
      db.prepare("INSERT INTO lead_search_criteria (label, state, city, zip_codes, max_price, min_profit, active) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        'Cleveland Gold Mine', 
        'OH', 
        'Cleveland', 
        '44102,44105,44108,44110,44112,44128', 
        250000, 
        25000,
        1
      );
    } else {
      // Ensure Cleveland is active and has correct ZIPs
      db.prepare("UPDATE lead_search_criteria SET active = 1, zip_codes = ? WHERE label = 'Cleveland Gold Mine'").run('44102,44105,44108,44110,44112,44128');
    }
    
    // Deactivate old markets to focus on Cleveland
    db.prepare("UPDATE lead_search_criteria SET active = 0 WHERE label != 'Cleveland Gold Mine'").run();
    
    log("[migration] Migration complete.");
  } catch (e) {
    console.error("Migration failed:", e);
  }
}

migrate();
