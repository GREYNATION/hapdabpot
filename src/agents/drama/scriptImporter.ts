import fs from 'fs';
import path from 'path';
import { GildedScript } from './GildedScripts.js';

/**
 * Parses the Gilded Claws Season 2 Markdown file into a structured Record.
 */
export function parseGildedScripts(filePath: string): Record<string, GildedScript> {
    if (!fs.existsSync(filePath)) {
        console.error(`[Importer] Script file not found: ${filePath}`);
        return {};
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const scripts: Record<string, GildedScript> = {};
    
    // Split by "### EP" to get each episode
    const episodes = content.split(/### EP\s+/).slice(1);

    episodes.forEach((epBlock) => {
        // Match "S02E01 — \"The Return\""
        const headerMatch = epBlock.match(/(S\d+E\d+)\s+—\s+"(.+?)"/);
        if (!headerMatch) return;

        const id = headerMatch[1];
        const title = headerMatch[2];
        const scenes: GildedScript['scenes'] = [];

        // Split by "---" to get scenes within the episode
        const sceneBlocks = epBlock.split(/---/).slice(1);
        
        // If no "---", the rest of the block is one scene
        const blocksToProcess = sceneBlocks.length > 0 ? sceneBlocks : [epBlock.split('\n').slice(1).join('\n')];

        blocksToProcess.forEach((sceneText) => {
            const locationMatch = sceneText.match(/\[SCENE:\s*(.+?)\]/);
            const descriptionMatch = sceneText.match(/\*\[(.+?)\]\*/);
            
            const dialogue: GildedScript['scenes'][0]['dialogue'] = [];
            const charactersSet = new Set<string>();

            // Dialogue regex: **NAME:** *(emotion)* line
            const dialogueRegex = /\*\*([^*]+):\*\*\s*(?:\*\(([^)]+)\)\*\s*)?(.+)/g;
            let match;
            while ((match = dialogueRegex.exec(sceneText)) !== null) {
                const character = match[1].trim();
                dialogue.push({
                    character,
                    emotion: match[2]?.trim() || 'neutral',
                    line: match[3].trim().replace(/\*.*?\*/g, '') // Remove internal stage directions
                });
                charactersSet.add(character);
            }

            if (dialogue.length > 0) {
                scenes.push({
                    location: locationMatch ? locationMatch[1].trim() : (descriptionMatch ? descriptionMatch[1].trim() : "Unknown Location"),
                    description: descriptionMatch ? descriptionMatch[1].trim() : "Cinematic scene",
                    characters: Array.from(charactersSet),
                    dialogue
                });
            }
        });

        if (scenes.length > 0) {
            scripts[id] = { id, title, scenes };
        }
    });

    return scripts;
}
