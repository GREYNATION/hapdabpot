import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, calculateSongROI } from "../../lib/supabase";
import type { Song } from "../../lib/supabase";
import { X, TrendingUp, Lock, Zap } from "lucide-react";
import { toast } from "sonner";

const TIERS = [
  { label: "Fan", minShares: 1, maxShares: 9, perks: ["Full audio stream"] },
  { label: "Investor", minShares: 10, maxShares: 24, perks: ["Full audio", "Music video"] },
  { label: "Major", minShares: 25, maxShares: 2500, perks: ["Full audio", "Music video", "Behind the scenes", "Unreleased content"], discount: 0.08 }
];

function getTier(shares: number) {
  return TIERS.find(t => shares >= t.minShares && shares <= t.maxShares) || TIERS[0];
}

export default function InvestModal({ song, user, onClose }: {
  song: Song;
  user: any;
  onClose: () => void;
}) {
  const [shares, setShares] = useState(10);
  const queryClient = useQueryClient();

  const sharesLeft = song.total_shares - song.shares_sold;
  const tier = getTier(shares);
  const discount = tier.label === "Major" ? 0.08 : 0;
  const pricePerShare = song.price_per_share * (1 - discount);
  const total = shares * pricePerShare;
  const roi = calculateSongROI(shares, song);

  const invest = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in to invest");

      // Check wallet balance
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (!wallet || wallet.balance < total) {
        throw new Error(`Insufficient balance. You need $${total.toFixed(2)} but have $${wallet?.balance?.toFixed(2) || "0.00"}`);
      }

      // Check shares available
      if (shares > sharesLeft) {
        throw new Error(`Only ${sharesLeft} shares available`);
      }

      // Upsert investment (add to existing if they already invested)
      const { data: existing } = await supabase
        .from("investments")
        .select("id, shares, total_paid")
        .eq("investor_id", user.id)
        .eq("song_id", song.id)
        .single();

      if (existing) {
        await supabase
          .from("investments")
          .update({
            shares: existing.shares + shares,
            total_paid: existing.total_paid + total
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("investments")
          .insert({
            investor_id: user.id,
            song_id: song.id,
            shares,
            price_per_share: pricePerShare,
            total_paid: total
          });
      }

      // Deduct from wallet
      await supabase
        .from("wallets")
        .update({ balance: wallet.balance - total, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      // Update shares sold on song
      await supabase
        .from("songs")
        .update({ shares_sold: song.shares_sold + shares })
        .eq("id", song.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["my-investments"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast.success(`Investment successful! You bought ${shares} shares.`);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#12121a] border border-white/10 rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="font-semibold text-lg">Invest in "{song.title}"</h2>
            <p className="text-white/50 text-sm">{(song as any).artists?.name || "Artist"}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Song stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/50 text-xs mb-1">Share Price</p>
              <p className="font-semibold">${pricePerShare.toFixed(2)}</p>
              {discount > 0 && <p className="text-green-400 text-xs">-{(discount*100).toFixed(0)}% bulk</p>}
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/50 text-xs mb-1">Shares Left</p>
              <p className="font-semibold">{sharesLeft.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/50 text-xs mb-1">Monthly Streams</p>
              <p className="font-semibold">{(song.monthly_streams / 1000).toFixed(0)}K</p>
            </div>
          </div>

          {/* Share selector */}
          <div>
            <label className="text-white/70 text-sm block mb-2">Number of Shares</label>
            <input
              type="number"
              value={shares}
              onChange={e => setShares(Math.max(1, Math.min(sharesLeft, parseInt(e.target.value) || 1)))}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-lg font-medium focus:outline-none focus:border-purple-500"
              min={1}
              max={sharesLeft}
            />
            {/* Quick amounts */}
            <div className="flex gap-2 mt-2">
              {[5, 10, 25, 50].map(n => (
                <button
                  key={n}
                  onClick={() => setShares(Math.min(n, sharesLeft))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    shares === n ? "bg-purple-600 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Tier badge */}
          <div className={`rounded-xl p-3 border ${
            tier.label === "Major" ? "border-yellow-500/30 bg-yellow-500/10" :
            tier.label === "Investor" ? "border-purple-500/30 bg-purple-500/10" :
            "border-white/10 bg-white/5"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-sm font-semibold ${
                tier.label === "Major" ? "text-yellow-400" :
                tier.label === "Investor" ? "text-purple-400" : "text-white/70"
              }`}>
                {tier.label} Tier
              </span>
              {tier.label === "Major" && <Zap size={14} className="text-yellow-400" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {tier.perks.map(perk => (
                <span key={perk} className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                  {perk.includes("Unreleased") || perk.includes("Behind") ? <Lock size={9} /> : null}
                  {perk}
                </span>
              ))}
            </div>
          </div>

          {/* ROI projection */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-green-400" />
              <span className="text-green-400 text-sm font-medium">Projected Returns</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/50 text-xs">Ownership</p>
                <p className="font-medium">{roi.ownershipPct.toFixed(4)}%</p>
              </div>
              <div>
                <p className="text-white/50 text-xs">Monthly earnings</p>
                <p className="font-medium text-green-400">~${roi.monthlyEarnings.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs">Annual earnings</p>
                <p className="font-medium text-green-400">~${roi.annualEarnings.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs">Annual APY</p>
                <p className="font-medium text-green-400">{roi.annualAPY.toFixed(1)}%</p>
              </div>
            </div>
            <p className="text-white/30 text-xs mt-2">
              Based on current stream rate. Returns are estimates only.
            </p>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between text-lg font-semibold">
            <span className="text-white/70">Total</span>
            <span className="text-purple-400">${total.toFixed(2)}</span>
          </div>

          {/* Invest button */}
          <button
            onClick={() => invest.mutate()}
            disabled={invest.isPending || !user || shares < 1}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {invest.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <TrendingUp size={18} />
                {user ? `Invest $${total.toFixed(2)}` : "Sign in to Invest"}
              </>
            )}
          </button>

          {!user && (
            <p className="text-center text-white/40 text-sm">
              <a href="/auth" className="text-purple-400 hover:underline">Create an account</a> to start investing
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
