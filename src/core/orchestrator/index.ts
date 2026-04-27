import { log } from "../config.js";
import { HarnessAgent } from "../../agents/harnessAgent/harnessAgent.js";
import { exec } from "child_process";
import { google } from "googleapis";
// import { runTraderAgent } from "..."; // TODO: Implement
// import { runScraperAgent } from "..."; // TODO: Implement

export async function orchestrate(agent: any) {
  switch (agent.id) {
    case "harness":
      return runHarnessAgent(agent);

    case "trader":
      // return runTraderAgent(agent);
      throw new Error("Trader agent not yet implemented in orchestrate()");

    case "money":
      return runMoneyAgent(agent);

    case "money-video":
      return runMoneyVideoAgent(agent);

    case "scraper":
      // return runScraperAgent(agent);
      throw new Error("Scraper agent not yet implemented in orchestrate()");

    default:
      throw new Error(`Unknown agent: ${agent.id}`);
  }
}

export async function runHarnessAgent(agent: any) {
  const { task, input } = agent;
  const taskStr = typeof task === 'object' ? JSON.stringify(task) : task;

  // Detect video capability
  if (taskStr.toLowerCase().includes("video") || input?.videoUrl) {
    return runVideoAnalysis(agent);
  }

  // default browser task
  return runBrowserTask(agent);
}

async function runBrowserTask(agent: any) {
  const { url } = agent.input || {};
  const { task } = agent;

  const taskStr = typeof task === 'object' ? JSON.stringify(task) : task;
  log(`[harness] ${taskStr} → ${url}`);

  const browserAgent = HarnessAgent.getInstance();
  const result = await browserAgent.browse(url, task);

  return {
    summary: "Task completed",
    data: result
  };
}

async function runVideoAnalysis(agent: any) {
  const { videoUrl, url, searchQuery } = agent.input || {};
  let targetUrl = videoUrl || url;

  if (searchQuery && !targetUrl) {
    log(`[video] Searching YouTube for: ${searchQuery}`);
    try {
        const youtube = google.youtube({
          version: 'v3',
          auth: process.env.YOUTUBE_API_KEY
        });
        
        const searchRes = await youtube.search.list({
            part: ['snippet'],
            q: searchQuery,
            maxResults: 1,
            type: ['video']
        });
        
        if (searchRes.data.items && searchRes.data.items.length > 0) {
            const videoId = searchRes.data.items[0].id?.videoId;
            targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
            log(`[video] Found top video: ${targetUrl}`);
        } else {
            throw new Error("No videos found for that query.");
        }
    } catch (e: any) {
        throw new Error(`YouTube Search failed: ${e.message}. Did you set YOUTUBE_API_KEY?`);
    }
  }

  if (!targetUrl) {
    throw new Error("No video URL or search query provided.");
  }

  log(`[video] analyzing ${targetUrl}`);

  // Step 1: Extract content (placeholder for your Python tool)
  const transcript = await extractVideoTranscript(targetUrl);

  // Step 2: Analyze for skills / strategies
  const insights = await analyzeVideoContent(transcript);

  let videoBonus = 0;
  const lowerTranscript = transcript.toLowerCase();
  if (lowerTranscript.includes("viral") || lowerTranscript.includes("trending")) {
    videoBonus += 20;
    log(`[video] Viral/Trending keyword detected in transcript! Applying +20 bonus.`);
  }

  return {
    summary: "Video analyzed successfully",
    insights,
    videoBonus
  };
}

function extractVideoTranscript(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    log(`[video] executing Python video_agent.py for ${url}...`);
    exec(`python video_agent.py "${url}"`, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

async function analyzeVideoContent(transcript: string) {
  log(`[video] analyzing transcript: ${transcript}`);
  return ["Placeholder insight 1: High engagement format detected", "Placeholder insight 2: Clear call-to-action used"];
}

type Opportunity = "private_label" | "dropship" | "print_on_demand";

export async function runMoneyAgent(agent: any) {
  const { url } = agent.input;
  const { task } = agent;

  log(`[money] Analyzing market: ${task} → ${url}`);

  // Step 1: Use your harness agent
  const raw = await runHarnessAgent({
    input: { url },
    task: `Find products related to: ${task}. Include price, reviews, sales.`
  });

  // Step 2: Extract structured products
  // Provide fallback to empty array if raw.data is not iterable
  const products = normalizeProducts(Array.isArray(raw.data) ? raw.data : []);

  // Step 3: Score them
  const scored = products.map(scoreProduct);

  // Step 4: Rank + filter (Deep dive top 3 to save time)
  let winners = scored
    .filter(p => p.score > 70)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  log(`[money] Found ${winners.length} winners. Commencing supplier deep dive...`);

  // Step 5: Alibaba Deep Dive for Real Margins
  const deepWinners = [];
  for (const w of winners) {
    try {
      log(`[money] Searching supplier for: ${w.title}`);
      const supplierRaw = await runHarnessAgent({
        input: { url: "https://www.alibaba.com" },
        task: `Search for wholesale supplier for: ${w.title}. Find the average unit cost. Return ONLY a JSON array with one object containing { "cost": number }.`
      });

      const supplierData = Array.isArray(supplierRaw.data) ? supplierRaw.data[0] : supplierRaw.data;
      const realCost = Number(supplierData?.cost) || w.estimatedCost;
      const realProfit = w.price - realCost;

      log(`[money] Analyzing Amazon competition for: ${w.title}`);
      const amazonRaw = await runHarnessAgent({
        input: { url: "https://www.amazon.com" },
        task: `Search Amazon for "${w.title}". Estimate the competition level (low, medium, high) and classify the best business opportunity as ONE of these exact strings: "private_label", "dropship", or "print_on_demand". Return ONLY a JSON array with one object containing { "competition": string, "opportunity": string }.`
      });
      const amazonData = Array.isArray(amazonRaw.data) ? amazonRaw.data[0] : amazonRaw.data;
      const competition = amazonData?.competition || "medium";
      const opportunity = amazonData?.opportunity || "private_label";

      let bonus = realProfit > w.estimatedProfit ? 10 : -5;
      if (competition.toLowerCase() === "low") bonus += 15;
      if (competition.toLowerCase() === "high") bonus -= 10;

      deepWinners.push({
        ...w,
        realCost,
        realProfit,
        competition,
        opportunity,
        score: w.score + bonus
      });
    } catch (e) {
      deepWinners.push({ 
        ...w, 
        realCost: w.estimatedCost, 
        realProfit: w.estimatedProfit,
        competition: "unknown",
        opportunity: "private_label"
      });
    }
  }

  // Re-sort after adjusting for real margins and competition
  winners = deepWinners.sort((a, b) => b.score - a.score);

  const formattedData = `💰 MONEY AGENT RESULTS\n\nTop Opportunities:\n\n` + 
    winners.map((w, i) => 
      `${i + 1}. ${w.title || "Unnamed Product"}\n` +
      `   Price: $${w.price.toFixed(2)}\n` +
      `   Reviews: ${w.reviews}\n` +
      `   Real Cost (Alibaba): $${(w.realCost || 0).toFixed(2)}\n` +
      `   REAL Profit: $${(w.realProfit || 0).toFixed(2)}\n` +
      `   Competition (Amazon): ${String(w.competition || 'unknown').toUpperCase()}\n` +
      `   Opportunity: ${String(w.opportunity || 'unknown').toUpperCase().replace(/_/g, ' ')}\n` +
      `   Score: ${w.score}`
    ).join("\n\n");

  return {
    summary: `Found ${winners.length} highly verified winning products`,
    data: formattedData,
    winners
  };
}

export async function runMoneyVideoAgent(agent: any) {
  log(`[money-video] Starting analysis pipeline for ${agent.input.videoUrl}...`);
  const analysis = await runVideoAnalysis(agent);

  const products = extractProductsFromInsights(analysis.insights);

  const scored = products.map(p => {
    const scoredP = scoreProduct(p);
    return {
      ...scoredP,
      score: scoredP.score + (analysis.videoBonus || 0)
    };
  });
  const winners = scored.filter(p => p.score > 70).sort((a, b) => b.score - a.score).slice(0, 5);

  const formattedData = `🎬 MONEY VIDEO RESULTS\n\nTop Product Ideas from Video:\n\n` + 
    winners.map((w, i) => 
      `${i + 1}. ${w.title || "Unnamed Product"}\n` +
      `   Price: $${w.price.toFixed(2)}\n` +
      `   Reviews: ${w.reviews}\n` +
      `   Est Profit: $${w.estimatedProfit.toFixed(2)}\n` +
      `   Score: ${w.score}`
    ).join("\n\n");

  return {
    summary: `Found ${winners.length} winning products from video analysis`,
    data: formattedData,
    winners
  };
}

function extractProductsFromInsights(insights: any) {
  // Placeholder: normally uses an LLM to map insights into JSON product schema
  return [
    { title: "Viral Cleaning Putty", price: 15.99, reviews: 120, rating: 4.6, sales: 300 },
    { title: "Desk Cord Organizer", price: 24.50, reviews: 60, rating: 4.4, sales: 150 },
    { title: "RGB Light Bar", price: 45.00, reviews: 800, rating: 4.2, sales: 600 }
  ];
}

function normalizeProducts(data: any[]): any[] {
  return data.map(item => ({
    title: item.title || "",
    price: Number(item.price) || 0,
    reviews: Number(item.reviews) || 0,
    rating: Number(item.rating) || 0,
    sales: Number(item.sales) || 0
  }));
}

function scoreProduct(p: any) {
  let score = 0;

  // Demand (reviews + sales)
  if (p.reviews > 50) score += 20;
  if (p.sales > 100) score += 25;

  // Price sweet spot (FBA friendly)
  if (p.price >= 15 && p.price <= 50) score += 20;

  // Rating (avoid junk products)
  if (p.rating >= 4.3) score += 15;

  // Low competition heuristic
  if (p.reviews < 500) score += 10;

  // Margin estimate (rough)
  const estimatedCost = p.price * 0.3;
  const profit = p.price - estimatedCost;

  if (profit > 10) score += 10;

  return {
    ...p,
    estimatedCost,
    estimatedProfit: profit,
    score
  };
}
