import { useQuery } from "@tanstack/react-query";
import { supabase, STREAM_RATE } from "../lib/supabase";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, Music, TrendingUp, Headphones } from "lucide-react";

export default function RoyaltiesPage({ user }: { user: any }) {
  const { data: investments = [] } = useQuery({
    queryKey: ["investments-with-songs", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("investments")
        .select("*, songs(*, artists(name))")
        .eq("investor_id", user.id);
      return data || [];
    }
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["payouts", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("royalty_payouts")
        .select("*")
        .eq("investor_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    }
  });

  // Calculate totals
  const totalEarned = payouts.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
  const totalShares = investments.reduce((sum: number, i: any) => sum + i.shares, 0);
  const avgOwnership = investments.length > 0
    ? investments.reduce((sum: number, i: any) => sum + (i.shares / i.songs.total_shares) * 100, 0) / investments.length
    : 0;

  // Monthly earnings estimate
  const monthlyEst = investments.reduce((sum: number, inv: any) => {
    const ownership = inv.shares / inv.songs.total_shares;
    return sum + (inv.songs.monthly_streams * STREAM_RATE * ownership);
  }, 0);

  // Build chart data (last 12 months)
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - i));
    const monthStr = date.toISOString().slice(0, 7);
    const monthPayouts = payouts.filter((p: any) => p.created_at?.startsWith(monthStr));
    return {
      month: date.toLocaleDateString("en-US", { month: "short" }),
      earnings: monthPayouts.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0)
    };
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Royalties</h1>
        <p className="text-white/50">Your earnings from song streams</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Earnings", value: `$${totalEarned.toFixed(4)}`, icon: DollarSign, color: "text-green-400" },
          { label: "Monthly Est.", value: `$${monthlyEst.toFixed(4)}`, icon: TrendingUp, color: "text-purple-400" },
          { label: "Total Shares", value: totalShares, icon: Music, color: "text-blue-400" },
          { label: "Avg Ownership", value: `${avgOwnership.toFixed(4)}%`, icon: Headphones, color: "text-orange-400" }
        ].map(stat => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={16} className={stat.color} />
              <p className="text-white/50 text-sm">{stat.label}</p>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-purple-400" />
          Historical Payout Trend (12 months)
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              labelStyle={{ color: "rgba(255,255,255,0.7)" }}
              formatter={(v: any) => [`$${Number(v).toFixed(4)}`, "Earnings"]}
            />
            <Area type="monotone" dataKey="earnings" stroke="#9333ea" strokeWidth={2} fill="url(#earningsGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Earnings by track */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Music size={16} className="text-purple-400" />
          Earnings by Track
        </h2>
        {investments.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <Music size={40} className="mx-auto mb-3 opacity-30" />
            <p>No investments yet. Start investing to earn royalties.</p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-4 text-xs text-white/40 pb-2 border-b border-white/10 px-2">
              <span>Track / Artist</span>
              <span className="text-right">Total Earned</span>
              <span className="text-right">Monthly Est.</span>
              <span className="text-right">Streams</span>
            </div>
            {investments.map((inv: any) => {
              const ownership = inv.shares / inv.songs.total_shares;
              const monthlyEarnings = inv.songs.monthly_streams * STREAM_RATE * ownership;
              const invPayouts = payouts.filter((p: any) => p.song_id === inv.song_id);
              const totalEarnedForTrack = invPayouts.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);

              return (
                <div key={inv.id} className="grid grid-cols-4 py-3 px-2 hover:bg-white/5 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-900 rounded-lg flex-shrink-0 overflow-hidden">
                      {inv.songs.cover_url && (
                        <img src={inv.songs.cover_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-24">{inv.songs.title}</p>
                      <p className="text-xs text-white/40">{inv.songs.artists?.name} · {inv.shares} shares ({(ownership * 100).toFixed(3)}%)</p>
                    </div>
                  </div>
                  <p className="text-right text-purple-400 font-medium self-center">${totalEarnedForTrack.toFixed(4)}</p>
                  <p className="text-right text-white/60 text-sm self-center">~${monthlyEarnings.toFixed(4)}/mo</p>
                  <p className="text-right text-white/40 text-sm self-center">{(inv.songs.monthly_streams / 1000).toFixed(0)}K</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
