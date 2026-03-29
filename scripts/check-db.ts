import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'gravity-claw.db');
const db = new Database(dbPath);

async function checkRecent() {
    try {
        console.log('--- RECENT MESSAGES ---');
        const messages = db.prepare('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 30').all();
        console.log(JSON.stringify(messages, null, 2));

        console.log('\n--- RECENT DEALS ---');
        const deals = db.prepare('SELECT * FROM deals ORDER BY created_at DESC LIMIT 5').all();
        console.log(JSON.stringify(deals, null, 2));
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

checkRecent();
