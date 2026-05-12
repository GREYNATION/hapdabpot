export interface Lead {
  address: string;
  city: string;
  state: string;
  price?: number;
  source: string;
  type: string;
  url?: string;
  description?: string;
  postedDate?: string;
  distressSignals: string[];
  qualityScore?: number;
  dealScore?: number;
  maxOffer?: number;
  arv?: number;
  repairs?: number;
  lotSize?: number;
  owner?: string;
  absentee?: boolean;
  zip?: string;
  
  // DQS Components (per user request)
  equityScore?: number;
  motivationScore?: number;
  marketScore?: number;
  conditionScore?: number;
  dataScore?: number;

  // AI Refinement (Step 7)
  aiCondition?: number; // 1-10
  aiUrgency?: "High" | "Medium" | "Low";
  aiSummary?: string; // Summary of seller intent

  // Profit Simulator (Step 10)
  estimated_offer?: number;
  repair_estimate?: number;
  closing_costs?: number;
  assignment_fee?: number;
  profit?: number;
  roi?: number;
  verdict?: "GOOD_DEAL" | "MARGINAL" | "BAD_DEAL";

  // Additional fields for CRM/Telegram
  id?: number;
  alerted?: boolean;
  notes?: string;
  max_offer?: number;
  status?: string;
}
