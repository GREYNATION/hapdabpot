// ============================================================
// OUT THE WAY — Episode 1 Real Production Runner
// Loads existing ep_1.json → Production (Runway + ElevenLabs)
//                          → Assembly (final mp4 + srt)
// Skips: Story, Scene, Music, Posting (already done / not needed)
// ============================================================

import fs from "fs";
import path from "path";
import { MonitoringAgent } from "./src/agents/outtheway/monitoringAgent.js";
import { ProductionAgent } from "./src/agents/outtheway/productionAgent.js";
import { AssemblyAgent } from "./src/agents/outtheway/assemblyAgent.js";
import { log } from "./src/core/config.js";
import type { Episode } from "./src/agents/outtheway/types.js";

const EPISODE_PATH = path.join(process.cwd(), "data", "outtheway", "episodes", "ep_1.json");

// ── Dashboard printer — shows live agent status every 30s ────────────
function startDashboardWatcher(monitor: MonitoringAgent): NodeJS.Timeout {
    return setInterval(() => {
        const dash = monitor.getDashboard();
        const ts   = new Date().toISOString().slice(11, 19);
        const lines = Object.entries(dash.agents).map(([name, entry]) => {
            const icon = { active: "🔄", idle: "⏸️ ", completed: "✅", failed: "❌" }[entry.status] ?? "⏸️ ";
            return `  ${icon} ${name.padEnd(12)} ${entry.status.padEnd(9)} | ${(entry.message ?? "").substring(0, 60)}`;
        }).join("\n");
        log(`\n━━━ DASHBOARD [${ts}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }, 30000);
}

async function main() {
    // ── Load existing episode ─────────────────────────────────────────
    if (!fs.existsSync(EPISODE_PATH)) {
        throw new Error(`Episode file not found: ${EPISODE_PATH}\nRun the story pipeline first!`);
    }
    const episode: Episode = JSON.parse(fs.readFileSync(EPISODE_PATH, "utf-8"));

    log(`\n🎬 ═══════════════════════════════════════════════════════`);
    log(`🎬  OUT THE WAY — EPISODE 1 REAL PRODUCTION`);
    log(`🎬  "${episode.title}" — ${episode.scenes.length} scenes`);
    log(`🎬  Runway Gen-3 + ElevenLabs (Jace / Nia / Rel)`);
    log(`🎬  Total target runtime: 45–60 seconds`);
    log(`🎬 ═══════════════════════════════════════════════════════\n`);

    // ── Initialize monitor ─────────────────────────────────────────────
    const monitor = new MonitoringAgent(episode.episodeNumber);
    monitor.report({
        agent: "monitoring",
        status: "active",
        message: `Real production started for ep ${episode.episodeNumber} — ${episode.scenes.length} scenes`,
        timestamp: ""
    });

    const dashTimer = startDashboardWatcher(monitor);

    // ── Initialize agents ──────────────────────────────────────────────
    const productionAgent = new ProductionAgent(monitor);
    const assemblyAgent   = new AssemblyAgent(monitor);

    const startedAt = Date.now();

    try {
        // ══════════════════════════════════════════════════════════════
        // PHASE 1: PRODUCTION — Runway clips + ElevenLabs voice lines
        // ══════════════════════════════════════════════════════════════
        log(`\n[${"PHASE 1".padEnd(8)}] 🎥 PRODUCTION — Generating ${episode.scenes.length} clips + voice lines`);
        log(`   → Runway Gen-3 Alpha Turbo (9:16 vertical, cinematic)`);
        log(`   → ElevenLabs: Jace[OBLx], Nia[DZ2U], Rel[aOZ9], Dre's Man[VR6A]`);
        log(`   → Estimated time: ${episode.scenes.length * 3}–${episode.scenes.length * 6} minutes\n`);

        const producedScenes = await productionAgent.produceScenes(episode.scenes, episode.episodeNumber);
        episode.scenes = producedScenes;

        // Count real vs stub after production
        const realClips  = producedScenes.filter(s => s.clipPath && fs.existsSync(s.clipPath) && fs.statSync(s.clipPath).size > 1000).length;
        const stubClips  = producedScenes.length - realClips;
        const totalLines = producedScenes.reduce((n, s) => n + s.dialogue.length, 0);
        const realAudio  = producedScenes.filter(s => s.audioPath && fs.existsSync(s.audioPath ?? "") && (fs.statSync(s.audioPath ?? "").size ?? 0) > 0).length;

        log(`\n📊 Production Results:`);
        log(`   Clips  : ${realClips} real / ${stubClips} stub`);
        log(`   Voice  : ${realAudio} scenes with audio / ${totalLines} total lines`);

        // ══════════════════════════════════════════════════════════════
        // PHASE 2: ASSEMBLY — FFmpeg concat → final 9:16 mp4 + SRT
        // ══════════════════════════════════════════════════════════════
        log(`\n[${"PHASE 2".padEnd(8)}] 🔧 ASSEMBLY — Concatenating clips + subtitles`);

        const finalVideoPath = await assemblyAgent.assembleEpisode(episode, producedScenes);
        episode.finalVideoPath = finalVideoPath;

        // ── Save updated episode with clip/audio paths ─────────────────
        fs.writeFileSync(EPISODE_PATH, JSON.stringify(episode, null, 2), "utf-8");
        log(`[runner] ✅ Episode JSON updated with production paths`);

        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        const mins    = Math.floor(elapsed / 60);
        const secs    = elapsed % 60;

        clearInterval(dashTimer);
        monitor.report({
            agent: "monitoring",
            status: "completed",
            message: `Episode 1 real production complete in ${mins}m${secs}s`,
            timestamp: ""
        });
        monitor.printSummary();

        // ── Final output report ────────────────────────────────────────
        log(`\n${"═".repeat(55)}`);
        log(`✅  EPISODE 1 — PRODUCTION COMPLETE`);
        log(`${"─".repeat(55)}`);
        log(`  Episode   : "${episode.title}"`);
        log(`  Runtime   : ~${producedScenes.reduce((n, s) => n + s.durationSeconds, 0)}s`);
        log(`  Clips     : ${realClips} real mp4s, ${stubClips} stubs`);
        log(`  Voice     : ${realAudio} audio scenes`);
        log(`  Total time: ${mins}m ${secs}s`);
        log(`${"─".repeat(55)}`);
        log(`  Final video    : ${finalVideoPath}`);
        log(`  Dashboard      : data/outtheway/dashboard.json`);
        log(`  Manifest       : data/outtheway/output/ep1_production_manifest.json`);
        log(`  Subtitles      : data/outtheway/output/ep_1.srt`);
        log(`${"─".repeat(55)}`);

        log(`\n📋 SCENE FILE REPORT:`);
        for (const scene of producedScenes) {
            const hasRealClip  = scene.clipPath && fs.existsSync(scene.clipPath) && fs.statSync(scene.clipPath).size > 1000;
            const hasRealAudio = scene.audioPath && fs.existsSync(scene.audioPath ?? "") && (fs.statSync(scene.audioPath ?? "").size ?? 0) > 0;
            const clipStatus   = hasRealClip  ? `✅ ${path.basename(scene.clipPath!)}` : `⚠️  stub (Runway pending/failed)`;
            const audioStatus  = scene.dialogue.length === 0
                ? `⏭  no dialogue`
                : hasRealAudio ? `✅ ${path.basename(scene.audioPath!)}` : `⚠️  stub`;

            log(`  Scene ${scene.sceneNumber}: 📹 ${clipStatus} | 🎙️  ${audioStatus}`);
        }

        log(`${"═".repeat(55)}\n`);

    } catch (err: any) {
        clearInterval(dashTimer);
        monitor.report({ agent: "monitoring", status: "failed", message: `Production FAILED: ${err.message}`, timestamp: "" });
        monitor.printSummary();
        log(`\n❌ PRODUCTION FAILED: ${err.message}`, "error");
        process.exit(1);
    }
}

main().catch(err => {
    log(`\n❌ FATAL: ${err.message}`, "error");
    process.exit(1);
});
