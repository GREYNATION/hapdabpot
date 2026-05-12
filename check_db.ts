import { getDb } from './src/core/memory.js';
import { log } from './src/core/config.js';

async function checkDb() {
  try {
    const criteria = getDb().prepare("SELECT * FROM lead_search_criteria").all();
    console.log("Lead Search Criteria:", JSON.stringify(criteria, null, 2));
  } catch (e) {
    console.error("Error checking DB:", e);
  }
}

checkDb();
