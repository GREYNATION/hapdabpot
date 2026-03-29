// ============================================================
// OUT THE WAY — Episode 1 Runner
// Full pipeline: Story → Scene → Production → Assembly
// NO posting, NO music (user request)
// ============================================================

import path from "path";
import fs from "fs";
import { runEpisodePipeline } from "./src/agents/outtheway/pipeline.js";
import { log } from "./src/core/config.js";

const DIRECTOR_NOTE = `
EPISODE 1 CREATIVE BRIEF — READ CAREFULLY:

THEME: Street drama, serious, deeply emotional
TONE: Dark, realistic, cinematic — think Euphoria meets The Wire in vertical format
FOCUS: Jace and Nia's relationship is cracking under pressure

PLOT:
Someone (a dealer named Dre — never shown on screen, only referenced) has been pressing Jace 
hard for money he doesn't have. Jace has been hiding this from Nia. Tonight, she finds out — 
not because he told her, but because Dre's people came to their door.

SCENE REQUIREMENTS (5–7 scenes, 2–4 seconds each, total 45–60 seconds):
1. COLD OPEN: Jace alone at night, visibly stressed — phone buzzes, he ignores it
2. Nia at home, notices his energy is off, tries to connect — he shuts her down gently
3. A knock at the door — Jace freezes. Nia goes to answer it. His face says everything.
4. Hallway confrontation — Dre's man at the door, a short tense exchange. Nia overhears.
5. Jace closes the door — faces Nia. She's holding back tears. "How much?" she asks.
6. Jace can't answer. Silence. The weight of it all on both their faces.
7. CLIFFHANGER: Jace's phone lights up on the table — a name we recognize. He doesn't pick it up. End.

DIALOGUE RULES:
- Sparse. Real. No monologues.
- Jace speaks in short sentences under pressure — he's guarded.
- Nia uses questions, not accusations. She's hurt but loves him.
- The tension lives in what ISN'T said.

VISUAL RULES:
- All vertical 9:16 framing 
- Low light — kitchen light, phone glow, streetlight through blinds
- Close-ups on hands, faces, eyes — not wide shots
- Gritty, textured — not glossy
`.trim();

async function main() {
    log(`\n🎬 ════════════════════════════════════════`);
    log(`🎬  OUT THE WAY — EPISODE 1 FULL PRODUCTION`);
    log(`🎬  Theme: Street drama / Jace & Nia tension`);
    log(`🎬  No posting. No music. Real clips only.`);
    log(`🎬 ════════════════════════════════════════\n`);

    const result = await runEpisodePipeline(1, {
        dryRun: false,
        directorNote: DIRECTOR_NOTE,
        skipPosting: true,  // User: DO NOT POST YET
        skipMusic: true,    // Not requested this run
    });

    // ── Print Scene Breakdown ────────────────────────────────
    log(`\n━━━━━━━━━━━━ SCENE BREAKDOWN ━━━━━━━━━━━━`);
    log(`Episode: ${result.episode.episodeNumber} — "${result.episode.title}"`);
    log(`Hook: ${result.episode.hook}`);
    log(`─────────────────────────────────────────`);

    for (const scene of result.episode.scenes) {
        const clip = scene.clipPath ? `✅ ${path.basename(scene.clipPath)}` : "⏳ stub";
        const audio = scene.audioPath ? `✅ ${path.basename(scene.audioPath)}` : "⏳ stub";
        log(`\nScene ${scene.sceneNumber}: ${scene.location}`);
        log(`  📹 Clip:  ${clip}`);
        log(`  🎙️  Audio: ${audio}`);
        log(`  ⏱️  Duration: ${scene.durationSeconds}s`);
    }

    // ── Print Dialogue Script ────────────────────────────────
    log(`\n━━━━━━━━━━━━ DIALOGUE SCRIPT ━━━━━━━━━━━━`);
    for (const scene of result.episode.scenes) {
        log(`\n[Scene ${scene.sceneNumber} — ${scene.location}]`);
        if (scene.dialogue && scene.dialogue.length > 0) {
            for (const line of scene.dialogue) {
                log(`  ${line.character.toUpperCase()}: "${line.line}"`);
            }
        } else {
            log(`  [No dialogue — visual only]`);
        }
    }

    log(`\n━━━━━━━━━━━━ CLIFFHANGER ━━━━━━━━━━━━━━━`);
    log(result.episode.cliffhanger);

    // ── Save breakdown to file ────────────────────────────────
    const breakdown = {
        episode: result.episode.episodeNumber,
        title: result.episode.title,
        hook: result.episode.hook,
        cliffhanger: result.episode.cliffhanger,
        synopsis: result.episode.synopsis,
        totalScenes: result.episode.scenes.length,
        estimatedDuration: `${result.episode.scenes.reduce((acc, s) => acc + s.durationSeconds, 0)}s`,
        finalVideoPath: result.finalVideoPath,
        scenes: result.episode.scenes.map(s => ({
            scene: s.sceneNumber,
            location: s.location,
            durationSeconds: s.durationSeconds,
            dialogue: s.dialogue,
            clipPath: s.clipPath,
            audioPath: s.audioPath,
        })),
        generatedAt: new Date().toISOString()
    };

    const outputPath = path.join(process.cwd(), "data", "outtheway", "ep1_breakdown.json");
    fs.writeFileSync(outputPath, JSON.stringify(breakdown, null, 2), "utf-8");
    log(`\n✅ EPISODE 1 COMPLETE`);
    log(`   Final Video:  ${result.finalVideoPath}`);
    log(`   Breakdown:    ${outputPath}`);
    log(`   Dashboard:    data/outtheway/dashboard.json`);
}

main().catch(err => {
    console.error(`\n❌ Episode 1 pipeline FAILED:`, err.message);
    process.exit(1);
});
