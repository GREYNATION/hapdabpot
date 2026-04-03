import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase, calculateSongROI } from "../lib/supabase";
import { Play, Lock, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import InvestModal from "../components/invest/InvestModal";
import { usePlayerStore } from "../components/player/playerStore";

export default function SongPage({ user }: { user: any }) {
  const { id } = useParams();
  const [showInvest, setShowInvest] = useState(false);
  const { play } = usePlayerStore();

  const { data: song, isLoading } = useQuery({
    queryKey: ["song", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("*, artists(name, avatar_url, bio)")
        .eq("id", id)
        .single();
      return data;
    }
  });

  const { data: investment } = useQuery({
    queryKey: ["investment", user?.id, id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("investments")
        .select("shares, total_paid")
        .eq("investor_id", user.id)
        .eq("song_id", id)
        .single();
      return data;
    }
  });

  const { data: investorCount } = useQuery({
    queryKey: ["investor-count", id],
    queryFn: async () => {
      const { count } = await supabase
        .from("investments")
        .select("*", { count: "exact" })
        .eq("song_id", id);
      return count || 0;
    }
  });

  if (isLoading) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="h-64 bg-white/5 rounded-2xl animate-pulse" /></div>;
  if (!song) return <div className="text-center py-20 text-white/40">Song not found</div>;

  const userShares = investment?.shares || 0;
  const soldPct = Math.round((song.shares_sold / song.total_shares) * 100);
  const roi = calculateSongROI(10, song);

  const CONTENT_TIERS = [
    { minShares: 0, label: "Preview", desc: "30-second preview", locked: userShares === 0 },
    { minShares: 1, label: "Full Stream", desc: "Complete audio stream", locked: userShares < 1 },
    { minShares: 10, label: "Music Video", desc: "Official music video", locked: userShares < 10 },
    { minShares: 25, label: "Exclusive Vault", desc: "Behind the scenes + unreleased", locked: userShares < 25 },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left — song info */}
        <div>
          <div
            className="aspect-square bg-gradient-to-br from-purple-900 to-black rounded-2xl overflow-hidden mb-6 relative cursor-pointer"
            onClick={() => play(song)}
          >
            {song.cover_url && <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />}
            {song.is_exclusive && (
              <div className="absolute top-4 left-4 bg-purple-600 text-xs px-3 py-1 rounded-full flex items-center gap-1">
                <Lock size={10} /> SonicStream Exclusive
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40">
              <Play size={56} className="text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-1">{song.title}</h1>
          <p className="text-white/60 text-lg mb-4">{song.artists?.name}</p>

          <div className="flex items-center gap-4 text-sm text-white/40 mb-6">
            <span>{(song.monthly_streams / 1000).toFixed(0)}K streams/mo</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Users size={13} /> {investorCount} investors</span>
            <span>·</span>
            <span>{song.genre}</span>
          </div>

          {/* Content tiers */}
          <div className="space-y-2">
            <p className="text-white/50 text-sm font-medium mb-3">Content Access</p>
            {CONTENT_TIERS.map(tier => (
              <div
                key={tier.label}
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  !tier.locked
                    ? "border-purple-500/30 bg-purple-500/10"
                    : "border-white/10 bg-white/5 opacity-60"
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${!tier.locked ? "text-purple-400" : "text-white/50"}`}>
                    {tier.label}
                  </p>
                  <p className="text-xs text-white/40">{tier.desc}</p>
                </div>
                {tier.locked ? (
                  <div className="flex items-center gap-1 text-xs text-white/30">
                    <Lock size={12} />
                    {tier.minShares}+ shares
                  </div>
                ) : (
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right — investment */}
        <div>
          {/* Progress */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/50">Shares sold</span>
              <span>{soldPct}%</span>
            </div>
            <div className="bg-white/10 rounded-full h-2 mb-3">
              <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${soldPct}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/40 text-xs">Shares left</p>
                <p className="font-semibold">{(song.total_shares - song.shares_sold).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Price/share</p>
                <p className="font-semibold">${song.price_per_share}</p>
              </div>
            </div>
          </div>

          {/* ROI preview */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 mb-4">
            <p className="text-green-400 text-sm font-medium flex items-center gap-2 mb-3">
              <TrendingUp size={14} /> Returns (per 10 shares)
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/40 text-xs">Monthly</p>
                <p className="text-green-400 font-semibold">~${roi.monthlyEarnings.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Annual APY</p>
                <p className="text-green-400 font-semibold">{roi.annualAPY.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* User's position */}
          {userShares > 0 && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5 mb-4">
              <p className="text-purple-400 text-sm font-medium mb-3">Your Position</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-white/40 text-xs">Shares owned</p>
                  <p className="font-semibold">{userShares}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Total paid</p>
                  <p className="font-semibold">${investment?.total_paid?.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowInvest(true)}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2 text-lg"
          >
            <TrendingUp size={20} />
            {userShares > 0 ? "Buy More Shares" : "Invest Now"}
          </button>
        </div>
      </div>

      {showInvest && <InvestModal song={song} user={user} onClose={() => setShowInvest(false)} />}
    </div>
  );
}
