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
            'wiki/attachments',
            'wiki/inbox',
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

    public static async saveNote(title: string, content: string, category: 'concepts' | 'entities' | 'sources' | 'inbox' = 'sources', tags: string[] = []) {
        const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
        const categoryPath = path.join(this.vaultPath, 'wiki', category);
        if (!fs.existsSync(categoryPath)) fs.mkdirSync(categoryPath, { recursive: true });
        
        const filePath = path.join(categoryPath, fileName);
        
        const timestamp = new Date().toISOString().split('T')[0];
        const fullTimestamp = new Date().toISOString();
        
        // Process content for automatic backlinking
        const linkedContent = await this.generateBacklinks(content);

        const frontmatter = `---
date: ${timestamp}
created: ${fullTimestamp}
category: ${category}
source: Telegram
tags: [${tags.join(', ')}]
---
# ${title}

`;
        fs.writeFileSync(filePath, frontmatter + linkedContent);
        log(`[wiki] Saved note: ${title} in ${category}`);
        
        // Log to wiki/log.md
        const logPath = path.join(this.vaultPath, 'wiki/log.md');
        const logEntry = `- [${fullTimestamp}] Saved ${category}/${fileName}: ${title}\n`;
        if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, "# Wiki Log\n\n");
        }
        fs.appendFileSync(logPath, logEntry);
    }

    /**
     * Scans content for concept names and converts them to [[links]].
     */
    private static async generateBacklinks(content: string): Promise<string> {
        const conceptsPath = path.join(this.vaultPath, 'wiki/concepts');
        if (!fs.existsSync(conceptsPath)) return content;

        const conceptFiles = fs.readdirSync(conceptsPath).filter(f => f.endsWith('.md'));
        let linkedContent = content;

        for (const file of conceptFiles) {
            const conceptName = path.basename(file, '.md').replace(/_/g, ' ');
            // Only link if it's a full word and not already linked
            const regex = new RegExp(`(?<!\\[\\[)\\b${conceptName}\\b(?!\\]\\])`, 'gi');
            linkedContent = linkedContent.replace(regex, `[[${conceptName}]]`);
        }

        return linkedContent;
    }

    public static async saveStructuredNote(data: {
        title: string,
        summary: string,
        concepts: string[],
        content: string,
        type?: string,
        sourceUrl?: string,
        tags?: string[],
        keyPoints?: string[],
        highlights?: string[]
    }) {
        const { title, summary, concepts, content, type = 'article', sourceUrl, tags = [], keyPoints = [], highlights = [] } = data;
        
        const timestamp = new Date().toISOString().split('T')[0];
        const fullTags = tags.map(t => t.startsWith('#') ? t : `#${t.toLowerCase()}`);
        
        let structuredContent = `---
title: ${title}
date: ${timestamp}
type: ${type}
source: ${sourceUrl || 'pasted'}
tags: [${fullTags.join(' ')}]
related: []
---

## Summary
${summary}

## Key Points
${keyPoints.length > 0 ? keyPoints.map(p => `- ${p}`).join('\n') : '- ' + summary.split('.')[0]}

## Concepts
${concepts.map(c => `**${c}** — `).join('\n')}

## Quotes / Highlights
${highlights.map(h => `> "${h}"`).join('\n')}

## My Take
[leave blank — I will fill this in]

## Backlinks
[[]]

---
## Deep Analysis (Legacy)
${content}
`;

        await this.saveNote(title, structuredContent, 'sources', [...tags, 'structured']);
        
        // Ensure concepts exist in the vault
        for (const concept of concepts) {
            const conceptPath = path.join(this.vaultPath, 'wiki/concepts', `${concept.toLowerCase().replace(/ /g, '_')}.md`);
            if (!fs.existsSync(conceptPath)) {
                await this.saveNote(concept, `Auto-generated concept from [[${title}]]`, 'concepts', ['auto-gen']);
            }
        }
    }

    public static async getLibraryContext(query: string, limit: number = 3): Promise<string> {
        const searchResults = await this.search(query);
        let context = "[Local Knowledge Base Context]\n";

        for (const relPath of searchResults.slice(0, limit)) {
            const fullPath = path.join(this.vaultPath, 'wiki', relPath);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                context += `--- FROM: ${relPath} ---\n${content}\n\n`;
            }
        }

        return context;
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

    public static async saveMedia(fileName: string, buffer: Buffer): Promise<string> {
        const filePath = path.join(this.vaultPath, 'wiki/attachments', fileName);
        fs.writeFileSync(filePath, buffer);
        log(`[wiki] Saved media to attachments: ${fileName}`);
        return filePath;
    }

    public static async saveFileNote(title: string, fileName: string, category: 'concepts' | 'entities' | 'sources' | 'inbox' = 'sources', tags: string[] = []) {
        const noteContent = `## Attachment\n![[${fileName}]]\n\n[File saved in attachments]`;
        await this.saveNote(title, noteContent, category, [...tags, 'attachment']);
    }

    public static async search(query: string): Promise<string[]> {
        const results: string[] = [];
        const wikiPath = path.join(this.vaultPath, 'wiki');
        
        const findFiles = (dir: string) => {
            if (!fs.existsSync(dir)) return;
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
