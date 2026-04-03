import { useQuery } from "@tanstack/react-query";
import { supabase, calculateROI } from "../lib/supabase";
import { TrendingUp, DollarSign, Music, Zap } from "lucide-react";
import { useState } from "react";
import InvestModal from "../components/invest/InvestModal";

export default function PortfolioPage({ user }: { user: any }) {
  const [selectedSong, setSelectedSong] = useState<any>(null);

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ["portfolio", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("investments")
        .select("*, songs(*, artists(name, avatar_url))")
        .eq("investor_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    }
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();
      return data;
    }
  });

  const { data: newSongs = [] } = useQuery({
    queryKey: ["new-songs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("*, artists(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    }
  });

  const totalValue = investments.reduce((sum: number, inv: any) => sum + inv.total_paid, 0);
  const totalProfit = investments.reduce((sum: number, inv: any) => {
    const roi = calculateROI(inv, inv.songs);
    return sum + (roi.annualEarnings / 12);
  }, 0);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Portfolio</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-white/50 text-sm mb-1 flex items-center gap-1.5">
            <DollarSign size={14} /> Total Value
          </p>
          <p className="text-3xl font-bold">${totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-white/50 text-sm mb-1 flex items-center gap-1.5">
            <TrendingUp size={14} /> Monthly Earnings
          </p>
          <p className="text-3xl font-bold text-green-400">+${totalProfit.toFixed(2)}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-white/50 text-sm mb-1 flex items-center gap-1.5">
            <Music size={14} /> Investments
          </p>
          <p className="text-3xl font-bold">{investments.length}</p>
        </div>
      </div>

      {/* Wallet */}
      <div className="bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/20 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/50 text-sm uppercase tracking-wider mb-1">Wallet Balance</p>
            <p className="text-4xl font-bold">${wallet?.balance?.toFixed(2) || "0.00"}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => depositFunds(user.id)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              + Deposit
            </button>
            <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              Withdraw
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          {[10, 25, 50, 100].map(amount => (
            <button
              key={amount}
              onClick={() => addFunds(user.id, amount)}
              className="bg-white/10 hover:bg-white/20 text-white/70 px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {/* One-click invest — new releases */}
      {newSongs.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Zap size={16} className="text-yellow-400" />
            One-Click Invest — New Releases
          </h2>
          <div className="space-y-3">
            {newSongs.map((song: any) => (
              <div key={song.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-900 rounded-xl overflow-hidden">
                    {song.cover_url && <img src={song.cover_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{song.title}</p>
                    <p className="text-xs text-white/40">{song.artists?.name} · ${song.price_per_share}/share</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSong(song)}
                  className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-400 text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Zap size={12} /> 1-Click
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Holdings */}
      <div>
        <h2 className="font-semibold mb-4">Your Investments</h2>
        {investments.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <Music size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-2">No investments yet</p>
            <p className="text-sm">Go to Discover to find songs to invest in</p>
          </div>
        ) : (
          <div className="space-y-2">
            {investments.map((inv: any) => {
              const roi = calculateROI(inv, inv.songs);
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-4 bg-white/5 hover:bg-white/8 border border-white/10 rounded-2xl p-4 transition-colors"
                >
                  <div className="w-12 h-12 bg-purple-900 rounded-xl overflow-hidden flex-shrink-0">
                    {inv.songs.cover_url && (
                      <img src={inv.songs.cover_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{inv.songs.title}</p>
                    <p className="text-white/40 text-sm">{inv.songs.artists?.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold">${inv.total_paid.toFixed(2)}</p>
                    <p className="text-green-400 text-sm">+{roi.annualAPY.toFixed(1)}%</p>
                  </div>
                  <div className="text-right text-sm flex-shrink-0">
                    <p className="text-white/60">{inv.shares} shares</p>
                    <p className="text-white/30">{roi.ownershipPct.toFixed(3)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedSong && (
        <InvestModal song={selectedSong} user={user} onClose={() => setSelectedSong(null)} />
      )}
    </div>
  );
}

async function addFunds(userId: string, amount: number) {
  await supabase.rpc("add_funds", { p_user_id: userId, p_amount: amount });
}

async function depositFunds(userId: string) {
  const amount = parseFloat(prompt("Enter deposit amount:") || "0");
  if (amount > 0) await addFunds(userId, amount);
}
