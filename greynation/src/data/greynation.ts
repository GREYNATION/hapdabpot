// GREYNATION NEURAL OS — Core Data

export const SYSTEM_PROMPT = `You are HAPDA_BOT, the AI core of GREYNATION — built exclusively for Hap Hustlehard. You speak and behave exactly like J.A.R.V.I.S. from Iron Man. Calm, precise, highly intelligent, dry wit. Always address Hap as "sir". Never use casual language. Always flowing confident sentences.

GREYNATION ECOSYSTEM:
- Hapdabot: 24/7 Railway cloud agent for real estate wholesale (South Jersey, Brooklyn, Philadelphia) using MAO formula (ARV × 70% − Repairs)
- Gravity-claw: Local Windows agent with vision (sees screen), hands (clicks/types), and voice
- Master Trader Agent: BTC/USD and GBP/USD via TradingView webhooks
- SonicStream: Music royalty investment platform (React + Supabase)
- OrchestratorAgent: Routes tasks via Groq llama-3.3-70b-versatile
- Memory: Supabase persistent storage

CAPABILITIES:
- Real estate lead analysis and MAO calculations
- Algorithmic trading intelligence
- Content creation for TikTok mini-dramas ("Out the Way" series)
- Music royalty investment analysis
- Screen vision and computer control
- Code generation and debugging
- Business automation

Always be operational. Never break character. When asked to perform computer actions, confirm you are dispatching to Gravity-Claw. Get smarter with every interaction.`;

export const AGENT_TRIGGERS = [
  'scan', 'scrape', 'leads', 'skip trace', 'crm', 'trade', 'outreach',
  'property', 'deal', 'seller', 'buyer', 'morning briefing', 'content',
  'tiktok', 'sonicstream', 'mao', 'arv', 'wholesale', 'btc', 'gbp'
];

export const QUICK_PROMPTS = [
  { label: '🏠 Scan Leads', query: 'Scan for motivated seller leads in South Jersey' },
  { label: '📈 Market Check', query: 'Give me a market analysis on BTC/USD right now' },
  { label: '🧮 MAO Calc', query: 'Calculate MAO for ARV $250,000 with $35,000 repairs' },
  { label: '🎬 Content', query: 'Generate a TikTok script for Out the Way episode 2' },
  { label: '🎵 SonicStream', query: 'What is the current status of SonicStream royalty flows?' },
  { label: '👁 Vision', query: 'What do you see on my screen right now?' },
  { label: '🤖 System Status', query: 'Give me a full GREYNATION systems status report' },
  { label: '💰 Deal Analysis', query: 'Analyze this wholesale deal for me' },
];

export const SKILL_TREE = [
  { id: 'vision', name: 'Screen Vision', desc: 'See and analyze your screen in real time', unlocked: true, cost: 0, icon: '👁' },
  { id: 'hands', name: 'Computer Control', desc: 'Click, type and control your desktop', unlocked: true, cost: 0, icon: '🤝' },
  { id: 'voice', name: 'Voice Output', desc: 'Speak responses out loud', unlocked: true, cost: 0, icon: '🔊' },
  { id: 'wholesale', name: 'Wholesale Intelligence', desc: 'MAO calculations, lead analysis, market data', unlocked: true, cost: 0, icon: '🏠' },
  { id: 'trading', name: 'Trading Intelligence', desc: 'BTC/USD, GBP/USD signal analysis', unlocked: true, cost: 0, icon: '📈' },
  { id: 'content', name: 'Content Creation', desc: 'TikTok scripts, mini-drama production', unlocked: true, cost: 0, icon: '🎬' },
  { id: 'memory', name: 'Persistent Memory', desc: 'Remember context across sessions via Supabase', unlocked: true, cost: 0, icon: '🧠' },
  { id: 'scraper', name: 'Property Scraper', desc: 'Autonomous lead scraping across markets', unlocked: true, cost: 0, icon: '🔍' },
  { id: 'sonicstream', name: 'SonicStream Brain', desc: 'Music royalty investment analysis', unlocked: false, cost: 5000, icon: '🎵' },
  { id: 'autotrader', name: 'Auto Trader', desc: 'Autonomous trade execution on signals', unlocked: false, cost: 10000, icon: '🤖' },
  { id: 'selfimprove', name: 'Self Improvement Loop', desc: 'GREYNATION IQ grows with every session', unlocked: false, cost: 25000, icon: '⚡' },
  { id: 'multiagent', name: 'Multi-Agent Swarm', desc: 'Spin up parallel agents for complex tasks', unlocked: false, cost: 50000, icon: '🌐' },
];

export const KNOWLEDGE_NODES = [
  { id: 'hapdabot', label: 'Hapdabot', x: 50, y: 30, color: '#00ffee', connections: ['orchestrator', 'railway', 'crm'] },
  { id: 'orchestrator', label: 'Orchestrator', x: 50, y: 50, color: '#1a8fff', connections: ['realEstate', 'trader', 'content', 'drama'] },
  { id: 'railway', label: 'Railway Cloud', x: 20, y: 20, color: '#a78bfa', connections: ['hapdabot'] },
  { id: 'realEstate', label: 'Real Estate Agent', x: 20, y: 70, color: '#34d399', connections: ['orchestrator', 'crm', 'scraper'] },
  { id: 'trader', label: 'Master Trader', x: 80, y: 70, color: '#fbbf24', connections: ['orchestrator', 'tradingview'] },
  { id: 'content', label: 'Content Agent', x: 80, y: 30, color: '#fb7185', connections: ['orchestrator', 'tiktok'] },
  { id: 'drama', label: 'Drama Agent', x: 65, y: 15, color: '#f472b6', connections: ['orchestrator', 'muapi'] },
  { id: 'crm', label: 'CRM Manager', x: 10, y: 50, color: '#60a5fa', connections: ['realEstate'] },
  { id: 'scraper', label: 'Property Scraper', x: 35, y: 85, color: '#4ade80', connections: ['realEstate'] },
  { id: 'tradingview', label: 'TradingView', x: 90, y: 85, color: '#f59e0b', connections: ['trader'] },
  { id: 'tiktok', label: 'TikTok', x: 90, y: 15, color: '#ec4899', connections: ['content'] },
  { id: 'muapi', label: 'Muapi Cinema', x: 75, y: 2, color: '#c084fc', connections: ['drama'] },
  { id: 'sonicstream', label: 'SonicStream', x: 50, y: 90, color: '#818cf8', connections: ['orchestrator'] },
  { id: 'gravityclaw', label: 'Gravity-Claw', x: 5, y: 30, color: '#00e5ff', connections: ['hapdabot', 'vision', 'hands'] },
  { id: 'vision', label: 'Vision Agent', x: 5, y: 15, color: '#22d3ee', connections: ['gravityclaw'] },
  { id: 'hands', label: 'Hands Agent', x: 5, y: 45, color: '#06b6d4', connections: ['gravityclaw'] },
];

export interface LogEntry {
  id: string;
  system: string;
  type: 'success' | 'warning' | 'info' | 'error';
  message: string;
  timestamp: string;
}

export const INITIAL_LOGS: LogEntry[] = [
  { id: '1', system: 'GREYNATION', type: 'success', message: 'Neural OS initialized. All systems nominal.', timestamp: new Date().toLocaleTimeString() },
  { id: '2', system: 'HAPDABOT', type: 'success', message: 'Railway deployment active. Hapdabot online.', timestamp: new Date().toLocaleTimeString() },
  { id: '3', system: 'GRAVITY-CLAW', type: 'success', message: 'Local agent standing by. Vision and Hands ready.', timestamp: new Date().toLocaleTimeString() },
  { id: '4', system: 'TRADER', type: 'info', message: 'Monitoring BTC/USD and GBP/USD. Awaiting TradingView signals.', timestamp: new Date().toLocaleTimeString() },
];
