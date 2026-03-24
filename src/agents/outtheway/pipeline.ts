// ============================================================
// OUT THE WAY — Episode Pipeline Orchestrator
// Runs the full agent chain for a complete episode
// Chains: Story → Scene → Production → Assembly → (Posting + Marketing)
// Music runs in parallel, independent of the main chain
// MonitoringAgent tracks everything
// ============================================================

import { log } from "../../core/config.js";
import { MonitoringAgent } from "./monitoringAgent.js";
import { StoryAgent } from "./storyAgent.js";
import { SceneAgent } from "./sceneAgent.js";
import { ProductionAgent } from "./productionAgent.js";
import { AssemblyAgent } from "./assemblyAgent.js";
import { PostingAgent } from "./postingAgent.js";
import { MarketingAgent } from "./marketingAgent.js";
import { MusicAgent } from "./musicAgent.js";
import type { Episode, MusicTrack, PostPayload, AgentName } from "./types.js";

// ============================================================
// Pipeline Options
// ============================================================

export interface PipelineOptions {
    /** If true, skip video/audio generation and use stubs only */
    dryRun?: boolean;
    /** Summarize the previous episode to feed into continuity */
    previousEpisodeSummary?: string;
    /** Director's creative note injected into story generation */
    directorNote?: string;
    /** Music track theme for this episode's Nia song */
    musicTheme?: string;
    /** Music mood */
    musicMood?: MusicTrack["mood"];
    /** If true, skip posting agent — prepare but do not queue posts */
    skipPosting?: boolean;
    /** If true, skip music generation for this run */
    skipMusic?: boolean;
}

export interface PipelineResult {
    episode: Episode;
    finalVideoPath: string;
    musicTrack?: MusicTrack;
    posts: PostPayload[];
    dashboard: ReturnType<MonitoringAgent["getDashboard"]>;
}

// ============================================================
// Main Pipeline Runner
// ============================================================

export async function runEpisodePipeline(
    episodeNumber: number,
    options: PipelineOptions = {}
): Promise<PipelineResult> {

    const {
        dryRun = false,
        previousEpisodeSummary,
        directorNote,
        musicTheme = "Love vs. the streets",
        musicMood = "soulful",
        skipPosting = false,
        skipMusic = false,
    } = options;

    log(`\n🎬 ═══════════════════════════════════════════════════`);
    log(`🎬  OUT THE WAY — STARTING EPISODE ${episodeNumber} PIPELINE`);
    log(`🎬 ═══════════════════════════════════════════════════\n`);

    // ── Initialize Monitoring (always first) ─────────────────
    const monitor = new MonitoringAgent(episodeNumber);
    monitor.report({
        agent: "monitoring",
        status: "active",
        message: `Pipeline started for episode ${episodeNumber}${dryRun ? " (DRY RUN)" : ""}`,
        timestamp: ""
    });

    // ── Initialize all agents ─────────────────────────────────
    const storyAgent      = new StoryAgent(monitor);
    const sceneAgent      = new SceneAgent(monitor);
    const productionAgent = new ProductionAgent(monitor);
    const assemblyAgent   = new AssemblyAgent(monitor);
    const postingAgent    = new PostingAgent(monitor);
    const marketingAgent  = new MarketingAgent(monitor);
    const musicAgent      = new MusicAgent(monitor);

    let episode: Episode;
    let finalVideoPath = "";
    let posts: PostPayload[] = [];
    let musicTrack: MusicTrack | undefined;

    try {
        // ── PHASE 1: Story Generation ─────────────────────────
        log(`\n📖 PHASE 1 — Story Generation`);
        episode = await withRetry(
            () => storyAgent.generateEpisode(episodeNumber, previousEpisodeSummary, directorNote),
            monitor, "story", 3
        );

        // ── PHASE 2: Scene Enhancement ────────────────────────
        log(`\n🎨 PHASE 2 — Scene Enhancement`);
        episode.scenes = await withRetry(
            () => sceneAgent.enhanceScenes(episode),
            monitor, "scene", 3
        );

        // ── PHASE 3: Production (clips + audio) ───────────────
        log(`\n🎥 PHASE 3 — Production`);
        if (!dryRun) {
            episode.scenes = await withRetry(
                () => productionAgent.produceScenes(episode.scenes, episodeNumber),
                monitor, "production", 3
            );
        } else {
            log(`[pipeline] DRY RUN — Skipping production, using stub paths`);
            monitor.report({ agent: "production", status: "completed", message: "DRY RUN — production skipped", timestamp: "" });
        }

        // ── PHASE 4: Assembly ────────────────────────────────
        log(`\n🔧 PHASE 4 — Assembly`);
        finalVideoPath = await withRetry(
            () => assemblyAgent.assembleEpisode(episode, episode.scenes),
            monitor, "assembly", 3
        );

        // ── PHASE 5: Marketing + Posting (parallel) ───────────
        if (!skipPosting) {
            log(`\n📣 PHASE 5 — Marketing & Posting (parallel)`);
            const [marketingPkg] = await Promise.all([
                withRetry(
                    () => marketingAgent.generatePackage(episode, finalVideoPath),
                    monitor, "marketing", 3
                ),
            ]);

            posts = await withRetry(
                () => postingAgent.prepareAndQueue(episode, finalVideoPath, marketingPkg.caption, marketingPkg.hashtags),
                monitor, "posting", 3
            );
        } else {
            log(`[pipeline] Posting skipped (skipPosting=true)`);
            monitor.report({ agent: "posting", status: "idle", message: "Posting skipped per options", timestamp: "" });
            monitor.report({ agent: "marketing", status: "idle", message: "Marketing skipped per options", timestamp: "" });
        }

        // ── MUSIC: Independent parallel track ─────────────────
        if (!skipMusic) {
            log(`\n🎵 MUSIC — Composing Nia Brooks track`);
            try {
                musicTrack = await musicAgent.createTrack(musicTheme, musicMood, episode.synopsis);
            } catch (err: any) {
                log(`[pipeline] ⚠️  Music track failed (non-critical): ${err.message}`, "warn");
            }
        } else {
            log(`[pipeline] Music skipped (skipMusic=true)`);
            monitor.report({ agent: "music", status: "idle", message: "Music skipped per options", timestamp: "" });
        }

        // ── Done ──────────────────────────────────────────────
        monitor.report({
            agent: "monitoring",
            status: "completed",
            message: `Episode ${episodeNumber} pipeline complete! Final: ${finalVideoPath}`,
            timestamp: ""
        });

        monitor.printSummary();

        return {
            episode,
            finalVideoPath,
            musicTrack,
            posts,
            dashboard: monitor.getDashboard()
        };

    } catch (err: any) {
        monitor.report({
            agent: "monitoring",
            status: "failed",
            message: `Pipeline failed for episode ${episodeNumber}: ${err.message}`,
            timestamp: ""
        });
        monitor.printSummary();
        throw err;
    }
}

// ============================================================
// Retry Wrapper
// ============================================================

async function withRetry<T>(
    fn: () => Promise<T>,
    monitor: MonitoringAgent,
    agentName: AgentName,
    maxRetries: number
): Promise<T> {
    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            return await fn();
        } catch (err: any) {
            attempts++;
            const isUnrecoverable = monitor.isUnrecoverable(agentName);
            if (attempts >= maxRetries || isUnrecoverable) {
                log(`[pipeline] ❌ Agent [${agentName}] failed after ${attempts} attempts. Aborting.`, "error");
                throw err;
            }
            const delay = attempts * 2000;
            log(`[pipeline] 🔁 Retrying [${agentName}] in ${delay}ms... (attempt ${attempts}/${maxRetries})`, "warn");
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`[pipeline] ${agentName} exceeded max retries`);
}

// ============================================================
// CLI Entry Point (run directly: npx tsx pipeline.ts)
// ============================================================

const isCLI = process.argv[1]?.endsWith("pipeline.ts") || process.argv[1]?.endsWith("pipeline.js");

if (isCLI) {
    const episodeArg = parseInt(process.argv[2] ?? "1", 10);
    const isDryRun   = process.argv.includes("--dry-run");

    log(`🚀 Running pipeline via CLI — Episode ${episodeArg}${isDryRun ? " (dry run)" : ""}`);

    runEpisodePipeline(episodeArg, { dryRun: isDryRun })
        .then(result => {
            log(`\n✅ Episode ${episodeArg} COMPLETE`);
            log(`   Video:  ${result.finalVideoPath}`);
            log(`   Posts:  ${result.posts.length} platforms queued`);
            log(`   Music:  ${result.musicTrack?.title ?? "none"}`);
            process.exit(0);
        })
        .catch(err => {
            log(`\n❌ Pipeline FAILED: ${err.message}`, "error");
            process.exit(1);
        });
}
