import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure we point to the root data folder
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '..', 'data', 'gravity-claw.db');

console.log(`📡 Initializing WholesaleOS Backend...`);
console.log(`📁 Database Path: ${DB_PATH}`);

const db = new Database(DB_PATH);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// API Routes
app.get('/api/deals', (req, res) => {
    try {
        const deals = db.prepare('SELECT * FROM deals ORDER BY updated_at DESC').all();
        const buyers = db.prepare('SELECT * FROM buyers').all();
        
        // Match buyers to deals
        const matchedDeals = deals.map(deal => {
            const potentialMatches = buyers.filter(buyer => {
                const criteria = (buyer.criteria || '').toLowerCase();
                const address = (deal.address || '').toLowerCase();
                
                // Simple matching: check if address keywords (boroughs/neighborhoods) are in criteria
                const keywords = ['brooklyn', 'queens', 'manhattan', 'bronx', 'staten', 'springfield', 'jersey'];
                const foundKeywords = keywords.filter(k => address.includes(k) && criteria.includes(k));
                
                return foundKeywords.length > 0;
            });
            
            return {
                ...deal,
                suggestedBuyer: potentialMatches.length > 0 ? potentialMatches[0].name : null,
                matchCount: potentialMatches.length
            };
        });
        
        res.json(matchedDeals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics', (req, res) => {
    try {
        // 1. Conversion Funnel
        const funnel = {
            lead: db.prepare("SELECT COUNT(*) as count FROM deals WHERE status = 'lead'").get().count,
            offerSent: db.prepare("SELECT COUNT(*) as count FROM deals WHERE status = 'offer sent'").get().count,
            contract: db.prepare("SELECT COUNT(*) as count FROM deals WHERE status = 'contract'").get().count,
            closed: db.prepare("SELECT COUNT(*) as count FROM deals WHERE status = 'closed'").get().count
        };

        // 2. Revenue & Win Rate
        const totalLeads = db.prepare("SELECT COUNT(*) as count FROM deals").get().count;
        const revenueData = db.prepare("SELECT SUM(profit) as total FROM deals WHERE status = 'closed'").get();
        const totalRevenue = revenueData.total || 0;
        const winRate = totalLeads > 0 ? (funnel.closed / totalLeads) * 100 : 0;

        // 3. Avg Days to Close
        const daysData = db.prepare(`
            SELECT AVG(JULIANDAY(updated_at) - JULIANDAY(created_at)) as avgDays 
            FROM deals 
            WHERE status = 'closed'
        `).get();
        const avgDaysToClose = Math.round(daysData.avgDays || 0);

        // 4. Monthly Revenue (Last 6 months)
        const monthlyRevenue = db.prepare(`
            SELECT STRFTIME('%Y-%m', created_at) as month, SUM(profit) as profit
            FROM deals
            WHERE status = 'closed'
            GROUP BY month
            ORDER BY month DESC
            LIMIT 6
        `).all();

        res.json({
            funnel,
            totalRevenue,
            winRate: Math.round(winRate),
            avgDaysToClose,
            monthlyRevenue: monthlyRevenue.reverse()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const totalDeals = db.prepare('SELECT COUNT(*) as count FROM deals').get().count;
        const contracts = db.prepare("SELECT COUNT(*) as count FROM deals WHERE status = 'contract'").get().count;
        const totalProfit = db.prepare('SELECT SUM(profit) as total FROM deals').get().total || 0;
        const avgArv = db.prepare('SELECT AVG(arv) as avg FROM deals').get().avg || 0;
        
        res.json({
            totalDeals,
            contracts,
            totalProfit,
            avgArv
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/buyers', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM buyers ORDER BY created_at DESC');
        const buyers = stmt.all();
        res.json(buyers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve static frontend
const frontendPath = path.resolve(__dirname, 'frontend', 'dist');
const indexPath = path.join(frontendPath, 'index.html');

console.log(`🌐 Frontend Path: ${frontendPath}`);
console.log(`📄 Index Path: ${indexPath}`);

if (!fs.existsSync(frontendPath)) {
    console.error(`❌ ERROR: Frontend build directory not found at ${frontendPath}`);
} else if (!fs.existsSync(indexPath)) {
    console.error(`❌ ERROR: index.html not found inside build directory at ${indexPath}`);
}

app.use(express.static(frontendPath));

// Serve index.html for all other routes (SPA fallback)
app.use((req, res) => {
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('WholesaleOS Frontend Not Built. Please run npm run build in frontend folder.');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 WholesaleOS LIVE at http://localhost:${PORT}`);
});
