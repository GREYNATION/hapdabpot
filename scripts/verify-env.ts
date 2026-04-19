import { config } from './src/core/config.js';

console.log('--- ENVIRONMENT VERIFICATION ---');
console.log(`DB_PATH from environment: ${process.env.DB_PATH || 'NOT SET'}`);
console.log(`Configured dbPath: ${config.dbPath}`);
console.log(`TELEGRAM_TOKEN set: ${config.telegramToken ? 'YES' : 'NO'}`);
console.log('--------------------------------');
