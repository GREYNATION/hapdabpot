import fs from 'fs';
import path from 'path';
import { log } from '../core/config.js';

export class WikiService {
    private static vaultPath = path.resolve('./claude-obsidian');

    public static async init() {
        const dirs = [
            'wiki/concepts',
            'wiki/entities',
            'wiki/sources',
            'wiki/meta',
            '_templates'
        ];

        for (const dir of dirs) {
            const fullPath = path.join(this.vaultPath, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                log(`[wiki] Created directory: ${dir}`);
            }
        }

        // Initialize Hot Cache if missing
        const hotPath = path.join(this.vaultPath, 'wiki/hot.md');
        if (!fs.existsSync(hotPath)) {
            fs.writeFileSync(hotPath, '# Hot Cache\n\nRecent activity and context summary.\n');
        }
    }

    public static async saveNote(title: string, content: string, category: 'concepts' | 'entities' | 'sources' = 'sources') {
        const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
        const filePath = path.join(this.vaultPath, 'wiki', category, fileName);
        
        const timestamp = new Date().toISOString();
        const frontmatter = `---
title: ${title}
created: ${timestamp}
category: ${category}
---

`;
        fs.writeFileSync(filePath, frontmatter + content);
        log(`[wiki] Saved note: ${title} in ${category}`);
        
        // Log to wiki/log.md
        const logPath = path.join(this.vaultPath, 'wiki/log.md');
        const logEntry = `- [${timestamp}] Saved ${category}/${fileName}: ${title}\n`;
        fs.appendFileSync(logPath, logEntry);
    }

    public static async updateHotCache(summary: string) {
        const hotPath = path.join(this.vaultPath, 'wiki/hot.md');
        const timestamp = new Date().toLocaleString();
        const content = `# Hot Cache\n\nLast Updated: ${timestamp}\n\n## Recent Summary\n${summary}\n`;
        fs.writeFileSync(hotPath, content);
        log(`[wiki] Updated hot cache.`);
    }

    public static getHotCache(): string {
        const hotPath = path.join(this.vaultPath, 'wiki/hot.md');
        if (fs.existsSync(hotPath)) {
            return fs.readFileSync(hotPath, 'utf8');
        }
        return "No recent context found.";
    }

    public static async search(query: string): Promise<string[]> {
        // Simple file search for now, could be improved with BM25 or full-text index
        const results: string[] = [];
        const wikiPath = path.join(this.vaultPath, 'wiki');
        
        const findFiles = (dir: string) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    findFiles(fullPath);
                } else if (file.endsWith('.md')) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    if (content.toLowerCase().includes(query.toLowerCase())) {
                        results.push(path.relative(wikiPath, fullPath));
                    }
                }
            }
        };

        if (fs.existsSync(wikiPath)) {
            findFiles(wikiPath);
        }
        return results.slice(0, 10);
    }
}
