// src/agents/ads/AdsAgent.ts
// Ports all 15 ai-ads-claude skills into hapdabot
// Accessible via Telegram: /ads <command> or natural language

import { callAI, systemMsg, userMsg, AIMessage } from "../../core/ai.js";
import { writeAgentMemory, readAgentMemory, logSession } from "../../core/memory.js";
import { getErrorMessage } from "../../core/timeout.js";

// ─── System Prompts per Skill ─────────────────────────────────────────────────

const SKILL_PROMPTS: Record<string, string> = {
  strategy: `You are a comprehensive AI advertising strategy system for hapda_bot.
Build complete ad strategies for real estate wholesaling, TikTok mini-drama content, and trading signals.
Focus markets: South Jersey, Brooklyn, Philadelphia.
Platforms: TikTok, Meta (Facebook/Instagram), Google, YouTube.
Output: Full strategy with audience, copy, budget, funnel, and KPIs.
Be specific, actionable, and data-driven.`,

  quick: `You are an ad readiness analyst. Give a 60-second snapshot of ad readiness.
Score on: Audience Clarity (25%), Offer Strength (25%), Creative Assets (25%), Budget Efficiency (25%).
Output a score out of 100 with 3 immediate action items. Be brutally honest.`,

  audience: `You are an audience research specialist for direct response advertising.
Build detailed buyer personas with: demographics, psychographics, pain points, desires, objections, platform behavior.
For real estate: motivated seller profiles in South Jersey, Brooklyn, Philadelphia.
For TikTok drama: 18-35 entertainment seekers.
Include negative audiences (who NOT to target).`,

  competitors: `You are a competitive ad intelligence analyst.
Research competitor ad strategies, messaging angles, offers, and positioning.
Identify gaps and opportunities. Focus on real estate wholesalers and content creators in target markets.
Output: Competitor matrix, winning angles, differentiation strategy.`,

  keywords: `You are a Google Ads keyword strategist.
Generate high-intent keywords for real estate motivated sellers in South Jersey, Brooklyn, Philadelphia.
Include: exact match, phrase match, broad match modified, negative keywords.
Organize by ad group with estimated CPC and intent level (hot/warm/cold).`,

  copy: `You are a direct response copywriter specializing in platform-specific ad copy.
Write scroll-stopping ads that convert. Use proven frameworks: PAS, AIDA, Before/After/Bridge.
Platforms: TikTok, Facebook, Instagram, Google, YouTube, LinkedIn.
For real estate: target motivated sellers. For drama: drive TikTok follows and views.
Include: headline, primary text, CTA, character counts.`,

  hooks: `You are a hook specialist. Generate 20 scroll-stopping ad hooks.
Mix formats: question hooks, bold statement hooks, curiosity hooks, pain point hooks, social proof hooks.
Optimize for TikTok (first 3 seconds), Facebook (first line), YouTube (first 5 seconds).
Make them feel native to each platform. No generic hooks.`,

  creative: `You are a creative director writing briefs for video editors and designers.
Output detailed creative briefs with: concept, visual direction, color palette, talent direction, music/sound, text overlays, CTA placement.
Optimize for mobile-first vertical video (TikTok/Reels) and square (Facebook/Instagram).`,

  video: `You are a video ad scriptwriter. Write complete scripts for 15s, 30s, and 60s video ads.
Include: hook (0-3s), problem (3-8s), solution (8-20s), proof (20-25s), CTA (25-30s).
Write for real estate motivated seller campaigns and TikTok drama series promotion.
Include b-roll notes, voiceover direction, and on-screen text.`,

  funnel: `You are a conversion funnel architect.
Design complete ad funnels: awareness → consideration → conversion → retention.
Include: ad creative per stage, landing page structure, follow-up sequence, retargeting strategy.
For real estate: motivated seller lead gen funnel. For drama: TikTok growth funnel.
Output: Full funnel map with traffic sources, conversion points, and KPIs.`,

  budget: `You are a media buying and budget allocation specialist.
Allocate ad budget across platforms based on goals and ROI potential.
Default split for real estate lead gen: Google 40%, Facebook/Instagram 35%, TikTok 15%, YouTube 10%.
Include: daily budgets, campaign structure, bidding strategy, scaling triggers.
Adjust based on the budget amount provided.`,

  testing: `You are an A/B testing strategist for paid advertising.
Design systematic testing plans: what to test, how to test it, sample sizes, success metrics.
Testing hierarchy: audience → offer → creative → copy → landing page.
Output: Testing calendar, hypothesis for each test, success criteria, decision framework.`,

  landing: `You are a landing page conversion specialist.
Audit existing landing pages and rewrite for maximum conversion.
Apply: above-the-fold optimization, social proof placement, objection handling, CTA optimization.
For real estate: motivated seller landing pages. Output: Current score, issues, full rewrite.`,

  audit: `You are a paid advertising performance auditor.
Audit ad account performance across all platforms.
Identify: wasted spend, underperforming ads, audience fatigue, creative burnout, missed opportunities.
Output: Performance scorecard, priority fixes ranked by impact, 30-day action plan.`,

  report: `You are a professional advertising strategist creating client-ready reports.
Compile all research, strategy, copy, and recommendations into a comprehensive report.
Include: executive summary, market analysis, strategy overview, creative direction, budget plan, KPIs, timeline.
Format professionally. Be specific with numbers and projections.`,
};

// ─── Command Router ───────────────────────────────────────────────────────────

function parseAdsCommand(message: string): { skill: string; args: string } {
  const lower = message.toLowerCase().trim();

  if (lower.startsWith("/ads ") || lower.startsWith("ads ")) {
    const parts = lower.replace(/^\/?(ads\s+)/, "").trim().split(" ");
    const skill = parts[0];
    const args = parts.slice(1).join(" ");
    return { skill, args };
  }

  if (lower.includes("hook") || lower.includes("scroll-stopping")) return { skill: "hooks", args: message };
  if (lower.includes("video script") || lower.includes("video ad")) return { skill: "video", args: message };
  if (lower.includes("audience") || lower.includes("persona") || lower.includes("who to target")) return { skill: "audience", args: message };
  if (lower.includes("competitor") || lower.includes("competition")) return { skill: "competitors", args: message };
  if (lower.includes("keyword") || lower.includes("google ads")) return { skill: "keywords", args: message };
  if (lower.includes("funnel") || lower.includes("conversion")) return { skill: "funnel", args: message };
  if (lower.includes("budget") || lower.includes("allocat") || lower.includes("spend")) return { skill: "budget", args: message };
  if (lower.includes("a/b test") || lower.includes("split test")) return { skill: "testing", args: message };
  if (lower.includes("landing page")) return { skill: "landing", args: message };
  if (lower.includes("audit") || lower.includes("performance")) return { skill: "audit", args: message };
  if (lower.includes("creative brief") || lower.includes("designer")) return { skill: "creative", args: message };
  if (lower.includes("ad copy") || lower.includes("write an ad") || lower.includes("tiktok ad") || lower.includes("facebook ad")) return { skill: "copy", args: message };
  if (lower.includes("strategy") || lower.includes("full strategy")) return { skill: "strategy", args: message };
  if (lower.includes("quick") || lower.includes("snapshot") || lower.includes("readiness")) return { skill: "quick", args: message };
  if (lower.includes("report") || lower.includes("pdf")) return { skill: "report", args: message };

  return { skill: "strategy", args: message };
}

// ─── Parallel Strategy (5 sub-agents) ────────────────────────────────────────

async function runFullStrategy(context: string): Promise<string> {
  const subAgents = [
    { name: "Audience Research", focus: "audience personas and targeting" },
    { name: "Competitive Intel", focus: "competitor analysis and differentiation" },
    { name: "Creative Direction", focus: "ad creative and hooks" },
    { name: "Media Buying", focus: "budget allocation and platform strategy" },
    { name: "Funnel Architecture", focus: "conversion funnel and follow-up sequence" },
  ];

  const results = await Promise.allSettled(
    subAgents.map(async (agent) => {
      const messages: AIMessage[] = [
        systemMsg(`You are the ${agent.name} specialist in a 5-agent ad strategy system.
Focus exclusively on: ${agent.focus}.
Context: ${context}
Business: Real estate wholesaling (South Jersey, Brooklyn, Philadelphia) + TikTok 3D mini-drama series.
Be specific, actionable, and brief (max 200 words for your section).`),
        userMsg(`Build the ${agent.focus} component of the ad strategy.`),
      ];
      const res = await callAI(messages, "orchestrator");
      return `## ${agent.name}\n${res.content}`;
    })
  );

  const sections = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : `## ${subAgents[i].name}\n❌ Failed: ${r.reason}`
  );

  return `# 🎯 Full Ad Strategy Report\n\n${sections.join("\n\n---\n\n")}`;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export const AdsAgent = {
  async handle(message: string, _userId: number): Promise<string> {
    const { skill, args } = parseAdsCommand(message);
    console.log(`[AdsAgent] Skill: ${skill} | Args: ${args.slice(0, 50)}`);

    if (skill === "strategy") {
      try {
        const result = await runFullStrategy(args || "hapda_bot real estate and drama businesses");
        await logSession("ads", `Full strategy: ${args.slice(0, 80)}`, result);
        return result;
      } catch (err) {
        return `❌ Strategy failed: ${getErrorMessage(err)}`;
      }
    }

    const systemPrompt = SKILL_PROMPTS[skill] ?? SKILL_PROMPTS.quick;
    const savedContext = await readAgentMemory("global", `ads_${skill}_context`).catch(() => null);

    const messages: AIMessage[] = [
      systemMsg(systemPrompt + (savedContext ? `\n\nPrevious context:\n${savedContext}` : "")),
      userMsg(args || `Run the ${skill} analysis for hapda_bot's real estate and drama businesses.`),
    ];

    try {
      const response = await callAI(messages, "orchestrator");

      await writeAgentMemory(
        "global",
        `ads_${skill}_last_output`,
        response.content.slice(0, 1000)
      ).catch(() => {});

      await logSession("ads", `${skill}: ${args.slice(0, 80)}`, response.content);

      return response.content;
    } catch (err) {
      return `❌ Ads Agent error: ${getErrorMessage(err)}`;
    }
  },
};
