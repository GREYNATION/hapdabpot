/**
 * WebsitePipeline.ts
 * Chains: BrandAnalysisAgent → SceneGen → WebsiteBuilderAgent
 * Triggered via Telegram: /buildsite <business description>
 */

import { runBrandAnalysis, BrandProfile } from "./BrandAnalysisAgent.js";
import { runWebsiteBuilder, GeneratedSite } from "./WebsiteBuilderAgent.js";

export interface PipelineResult {
  profile: BrandProfile;
  site: GeneratedSite;
  steps: PipelineStep[];
}

export interface PipelineStep {
  name: string;
  status: "pending" | "running" | "done" | "error";
  output?: string;
  error?: string;
}

type ProgressCallback = (step: PipelineStep) => Promise<void>;

export async function runWebsitePipeline(
  userInput: string,
  onProgress?: ProgressCallback,
  outputDir?: string
): Promise<PipelineResult> {
  const steps: PipelineStep[] = [
    { name: "Brand Analysis", status: "pending" },
    { name: "Scene Generation", status: "pending" },
    { name: "Website Builder", status: "pending" },
  ];

  // ── Step 1: Brand Analysis ─────────────────────────────────────
  steps[0].status = "running";
  await onProgress?.(steps[0]);

  let profile: BrandProfile;
  try {
    const result = await runBrandAnalysis(userInput);
    profile = result.profile;
    steps[0].status = "done";
    steps[0].output = result.summary;
    await onProgress?.(steps[0]);
  } catch (err: any) {
    steps[0].status = "error";
    steps[0].error = err.message;
    await onProgress?.(steps[0]);
    throw new Error(`Brand Analysis failed: ${err.message}`);
  }

  // ── Step 2: Scene/Layout Generation ────────────────────────────
  steps[1].status = "running";
  await onProgress?.(steps[1]);

  const layoutConcepts = generateLayoutConcepts(profile);
  steps[1].status = "done";
  steps[1].output = layoutConcepts;
  await onProgress?.(steps[1]);

  // ── Step 3: Website Builder ────────────────────────────────────
  steps[2].status = "running";
  await onProgress?.(steps[2]);

  let site: GeneratedSite;
  try {
    const result = await runWebsiteBuilder(profile, outputDir ?? "./generated-sites");
    site = result.site;
    steps[2].status = "done";
    steps[2].output = result.summary;
    await onProgress?.(steps[2]);
  } catch (err: any) {
    steps[2].status = "error";
    steps[2].error = err.message;
    await onProgress?.(steps[2]);
    throw new Error(`Website Builder failed: ${err.message}`);
  }

  return { profile, site, steps };
}

function generateLayoutConcepts(profile: BrandProfile): string {
  const tone = profile.tone.toLowerCase();

  const concepts = [
    {
      emoji: "🏛️",
      name: "The Authority",
      desc: `Full-screen hero with bold headline, dark overlay, stat counters below fold. Ideal for ${profile.industry} credibility.`,
    },
    {
      emoji: "⚡",
      name: "The Converter",
      desc: `Centered CTA above fold, split-screen layout, sticky form sidebar. Optimized for "${profile.callToAction}" conversions.`,
    },
    {
      emoji: "🎨",
      name: "The Story",
      desc: `Scroll-animated sections, feature cards with icons, testimonials with avatars. Builds trust with ${profile.targetAudience}.`,
    },
  ];

  const chosen = tone === "professional" || tone === "luxury"
    ? "The Authority"
    : tone === "bold" || tone === "urgent"
    ? "The Converter"
    : "The Story";

  return (
    `🎬 *Scene Generation — 3 layout concepts:*\n\n` +
    concepts.map((c, i) => `${i + 1}. ${c.emoji} **${c.name}** — ${c.desc}`).join("\n\n") +
    `\n\n✅ Building with *${chosen}* for ${tone} tone...`
  );
}
