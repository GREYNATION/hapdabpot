import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types
export interface Song {
  id: string;
  title: string;
  artist_id: string;
  artist_name?: string;
  cover_url?: string;
  audio_url?: string;
  video_url?: string;
  genre: string;
  total_shares: number;
  shares_sold: number;
  price_per_share: number;
  total_streams: number;
  monthly_streams: number;
  is_exclusive: boolean;
  release_date: string;
  created_at: string;
}

export interface Artist {
  id: string;
  user_id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  spotify_id?: string;
  created_at: string;
}

export interface Investment {
  id: string;
  investor_id: string;
  song_id: string;
  shares: number;
  price_per_share: number;
  total_paid: number;
  created_at: string;
  song?: Song;
}

export interface RoyaltyPayout {
  id: string;
  investment_id: string;
  investor_id: string;
  song_id: string;
  amount: number;
  streams_this_period: number;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  total_deposited: number;
  total_withdrawn: number;
  total_earned: number;
  updated_at: string;
}

// Royalty calculation
export const STREAM_RATE = 0.004; // $0.004 per stream industry average

export function calculateROI(investment: Investment, song: Song) {
  const ownershipPct = (investment.shares / song.total_shares) * 100;
  const monthlyEarnings = song.monthly_streams * STREAM_RATE * (ownershipPct / 100);
  const annualEarnings = monthlyEarnings * 12;
  const totalInvested = investment.total_paid;
  const annualAPY = totalInvested > 0 ? (annualEarnings / totalInvested) * 100 : 0;
  const breakEvenMonths = monthlyEarnings > 0 ? totalInvested / monthlyEarnings : null;

  return {
    ownershipPct,
    monthlyEarnings,
    annualEarnings,
    annualAPY,
    breakEvenMonths
  };
}

export function calculateSongROI(shares: number, song: Song) {
  const ownershipPct = (shares / song.total_shares) * 100;
  const monthlyEarnings = song.monthly_streams * STREAM_RATE * (ownershipPct / 100);
  const annualEarnings = monthlyEarnings * 12;
  const totalInvested = shares * song.price_per_share;
  const annualAPY = totalInvested > 0 ? (annualEarnings / totalInvested) * 100 : 0;

  return {
    ownershipPct,
    monthlyEarnings,
    annualEarnings,
    annualAPY,
    totalInvested
  };
}
