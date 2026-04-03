import { useQuery } from "@tanstack/react-query";
import { supabase, calculateSongROI } from "../lib/supabase";
import type { Song } from "../lib/supabase";
import { useState } from "react";
import { Play, TrendingUp, Lock, Zap } from "lucide-react";
import InvestModal from "../components/invest/InvestModal";
import { usePlayerStore } from "../components/player/playerStore";

export default function DiscoverPage({ user }: { user: any }) {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const { play } = usePlayerStore();

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("*, artists(name, avatar_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Song & { artists: { name: string; avatar_url: string } })[];
    }
  });

  const { data: userInvestments = [] } = useQuery({
    queryKey: ["my-investments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("investments")
        .select("song_id, shares")
        .eq("investor_id", user.id);
      return data || [];
    }
  });

  const investedMap = new Map(userInvestments.map((i: any) => [i.song_id, i.shares]));

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-2xl h-72 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero section */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2">Discover</h1>
        <p className="text-white/50 text-lg">Invest in songs. Earn when they stream.</p>
      </div>

      {/* Featured / trending */}
      {songs.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap size={18} className="text-yellow-400" /> Trending Now
          </h2>
          <div className="relative overflow-x-auto">
            <div className="flex gap-4 pb-4" style={{ width: "max-content" }}>
              {songs.slice(0, 5).map(song => (
                <FeaturedCard
                  key={song.id}
                  song={song}
                  onInvest={() => setSelectedSong(song)}
                  onPlay={() => play(song)}
                  userShares={investedMap.get(song.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Investment Opportunities */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-purple-400" /> Investment Opportunities
        </h2>
        <div className="space-y-3">
          {songs.map(song => (
            <SongRow
              key={song.id}
              song={song}
              onInvest={() => setSelectedSong(song)}
              onPlay={() => play(song)}
              userShares={investedMap.get(song.id)}
            />
          ))}
        </div>
      </div>

      {/* Invest Modal */}
      {selectedSong && (
        <InvestModal
          song={selectedSong}
          user={user}
          onClose={() => setSelectedSong(null)}
        />
      )}
    </div>
  );
}

function FeaturedCard({ song, onInvest, onPlay, userShares }: any) {
  const roi = calculateSongROI(10, song);
  const soldPct = Math.round((song.shares_sold / song.total_shares) * 100);

  return (
    <div className="relative w-72 bg-white/5 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
      {song.is_exclusive && (
        <div className="absolute top-3 left-3 z-10 bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <Lock size={10} /> Exclusive
        </div>
      )}
      {userShares && (
        <div className="absolute top-3 right-3 z-10 bg-green-600/80 text-white text-xs px-2 py-1 rounded-full">
          You own {userShares} shares
        </div>
      )}
      <div
        className="h-44 bg-gradient-to-br from-purple-900 to-black relative cursor-pointer"
        onClick={onPlay}
      >
        {song.cover_url && (
          <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40">
          <Play size={40} className="text-white" />
        </div>
      </div>
      <div className="p-4">
        <p className="font-semibold truncate">{song.title}</p>
        <p className="text-white/50 text-sm">{(song as any).artists?.name}</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-white/50">${song.price_per_share}/share</span>
          <span className="text-green-400 font-medium">{roi.annualAPY.toFixed(0)}% APY</span>
        </div>
        <div className="mt-2 bg-white/10 rounded-full h-1.5">
          <div
            className="bg-purple-500 h-1.5 rounded-full"
            style={{ width: `${soldPct}%` }}
          />
        </div>
        <p className="text-white/30 text-xs mt-1">{soldPct}% sold</p>
        <button
          onClick={onInvest}
          className="mt-3 w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl text-sm font-medium transition-colors"
        >
          Invest
        </button>
      </div>
    </div>
  );
}

function SongRow({ song, onInvest, onPlay, userShares }: any) {
  const roi = calculateSongROI(10, song);
  const soldPct = Math.round((song.shares_sold / song.total_shares) * 100);
  const sharesLeft = song.total_shares - song.shares_sold;

  return (
    <div className="bg-white/5 hover:bg-white/8 border border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-colors">
      <div
        className="w-14 h-14 bg-gradient-to-br from-purple-900 to-black rounded-xl flex-shrink-0 cursor-pointer relative overflow-hidden"
        onClick={onPlay}
      >
        {song.cover_url && (
          <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
        )}
        {song.is_exclusive && (
          <div className="absolute bottom-0 right-0 bg-purple-600 p-0.5 rounded-tl-lg">
            <Lock size={8} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{song.title}</p>
          {userShares && (
            <span className="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded-full flex-shrink-0">
              {userShares} shares
            </span>
          )}
        </div>
        <p className="text-white/50 text-sm">{(song as any).artists?.name}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="bg-white/10 rounded-full h-1 flex-1 max-w-24">
            <div className="bg-purple-500 h-1 rounded-full" style={{ width: `${soldPct}%` }} />
          </div>
          <span className="text-white/40 text-xs">{sharesLeft.toLocaleString()} left</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-white/50 text-sm">${song.price_per_share}/share</p>
        <p className="text-green-400 text-sm font-medium">~${roi.monthlyEarnings.toFixed(2)}/mo</p>
        <p className="text-green-400/70 text-xs">{roi.annualAPY.toFixed(0)}% APY (10 shares)</p>
      </div>

      <button
        onClick={onInvest}
        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
      >
        Invest
      </button>
    </div>
  );
}
