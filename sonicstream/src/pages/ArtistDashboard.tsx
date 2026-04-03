import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Upload, BarChart2, Music, Users } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "songs", label: "Songs", icon: Music },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "investors", label: "Investors", icon: Users },
];

export default function ArtistDashboard({ user }: { user: any }) {
  const [tab, setTab] = useState("upload");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Artist Studio</h1>

      <div className="flex gap-2 mb-8 border-b border-white/10 pb-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "upload" && <UploadTab user={user} />}
      {tab === "songs" && <SongsTab user={user} />}
      {tab === "analytics" && <AnalyticsTab user={user} />}
      {tab === "investors" && <InvestorsTab user={user} />}
    </div>
  );
}

function UploadTab({ user }: { user: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    genre: "pop",
    price_per_share: "10",
    total_shares: "10000",
    is_exclusive: false,
    release_date: "",
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      // Get or create artist profile
      let { data: artist } = await supabase
        .from("artists")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!artist) {
        const { data: newArtist } = await supabase
          .from("artists")
          .insert({ user_id: user.id, name: user.email?.split("@")[0] || "Artist" })
          .select("id")
          .single();
        artist = newArtist;
      }

      if (!artist) throw new Error("Could not create artist profile");

      // Upload files
      let audioUrl = null, coverUrl = null, videoUrl = null;

      if (audioFile) {
        const { data } = await supabase.storage.from("songs")
          .upload(`${artist.id}/${Date.now()}_${audioFile.name}`, audioFile);
        if (data) {
          const { data: { publicUrl } } = supabase.storage.from("songs").getPublicUrl(data.path);
          audioUrl = publicUrl;
        }
      }

      if (coverFile) {
        const { data } = await supabase.storage.from("covers")
          .upload(`${artist.id}/${Date.now()}_${coverFile.name}`, coverFile);
        if (data) {
          const { data: { publicUrl } } = supabase.storage.from("covers").getPublicUrl(data.path);
          coverUrl = publicUrl;
        }
      }

      if (videoFile) {
        const { data } = await supabase.storage.from("videos")
          .upload(`${artist.id}/${Date.now()}_${videoFile.name}`, videoFile);
        if (data) {
          const { data: { publicUrl } } = supabase.storage.from("videos").getPublicUrl(data.path);
          videoUrl = publicUrl;
        }
      }

      // Insert song
      const { error } = await supabase.from("songs").insert({
        artist_id: artist.id,
        title: form.title,
        genre: form.genre,
        price_per_share: parseFloat(form.price_per_share),
        total_shares: parseInt(form.total_shares),
        is_exclusive: form.is_exclusive,
        release_date: form.release_date || null,
        audio_url: audioUrl,
        cover_url: coverUrl,
        video_url: videoUrl,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
      toast.success("Song published!");
      setForm({ title: "", genre: "pop", price_per_share: "10", total_shares: "10000", is_exclusive: false, release_date: "" });
      setAudioFile(null); setCoverFile(null); setVideoFile(null);
    },
    onError: (e: any) => toast.error(e.message)
  });

  return (
    <div className="max-w-2xl">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-sm text-white/60 block mb-1.5">Song Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Enter song title"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-sm text-white/60 block mb-1.5">Genre</label>
            <select
              value={form.genre}
              onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            >
              {["pop", "hip-hop", "r&b", "electronic", "rock", "jazz", "country", "other"].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/60 block mb-1.5">Release Date</label>
            <input
              type="date"
              value={form.release_date}
              onChange={e => setForm(f => ({ ...f, release_date: e.target.value }))}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-sm text-white/60 block mb-1.5">Price Per Share ($)</label>
            <input
              type="number"
              value={form.price_per_share}
              min="10"
              onChange={e => setForm(f => ({ ...f, price_per_share: e.target.value }))}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            />
            <p className="text-xs text-white/30 mt-1">Minimum $10/share</p>
          </div>

          <div>
            <label className="text-sm text-white/60 block mb-1.5">Total Shares</label>
            <input
              type="number"
              value={form.total_shares}
              max="10000"
              onChange={e => setForm(f => ({ ...f, total_shares: e.target.value }))}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            />
            <p className="text-xs text-white/30 mt-1">Max 10,000 shares</p>
          </div>
        </div>

        {/* File uploads */}
        <FileUpload label="Audio File" accept="audio/*" file={audioFile} onChange={setAudioFile} />
        <FileUpload label="Cover Art" accept="image/*" file={coverFile} onChange={setCoverFile} />
        <FileUpload label="Music Video (exclusive for investors)" accept="video/*" file={videoFile} onChange={setVideoFile} />

        {/* Exclusive toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setForm(f => ({ ...f, is_exclusive: !f.is_exclusive }))}
            className={`w-11 h-6 rounded-full transition-colors relative ${form.is_exclusive ? "bg-purple-600" : "bg-white/20"}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.is_exclusive ? "translate-x-6" : "translate-x-1"}`} />
          </div>
          <div>
            <p className="text-sm font-medium">SonicStream Exclusive</p>
            <p className="text-xs text-white/40">Only available on SonicStream — not on Spotify or Apple Music</p>
          </div>
        </label>

        {/* Max raise preview */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-sm">
          <p className="text-white/60 mb-1">Max raise at these settings:</p>
          <p className="text-purple-400 font-semibold text-lg">
            ${(parseFloat(form.price_per_share || "0") * parseInt(form.total_shares || "0")).toLocaleString()}
          </p>
          <p className="text-white/30 text-xs mt-1">
            {form.total_shares} shares × ${form.price_per_share}/share
          </p>
        </div>

        <button
          onClick={() => upload.mutate()}
          disabled={upload.isPending || !form.title}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {upload.isPending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Upload size={18} /> Publish Song</>
          )}
        </button>
      </div>
    </div>
  );
}

function FileUpload({ label, accept, file, onChange }: any) {
  return (
    <div>
      <label className="text-sm text-white/60 block mb-1.5">{label}</label>
      <label className="flex items-center justify-center gap-3 border-2 border-dashed border-white/20 rounded-xl p-6 cursor-pointer hover:border-purple-500/50 transition-colors">
        <Upload size={20} className="text-white/30" />
        <span className="text-white/40 text-sm">
          {file ? file.name : `Upload ${label.toLowerCase()}`}
        </span>
        <input type="file" accept={accept} className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
      </label>
    </div>
  );
}

function SongsTab({ user }: { user: any }) {
  const { data: songs = [] } = useQuery({
    queryKey: ["artist-songs", user.id],
    queryFn: async () => {
      const { data: artist } = await supabase.from("artists").select("id").eq("user_id", user.id).single();
      if (!artist) return [];
      const { data } = await supabase.from("songs").select("*").eq("artist_id", artist.id).order("created_at", { ascending: false });
      return data || [];
    }
  });

  return (
    <div className="space-y-3">
      {songs.length === 0 ? (
        <p className="text-white/40 text-center py-12">No songs uploaded yet.</p>
      ) : songs.map((song: any) => (
        <div key={song.id} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="w-12 h-12 bg-purple-900 rounded-xl overflow-hidden">
            {song.cover_url && <img src={song.cover_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1">
            <p className="font-medium">{song.title}</p>
            <p className="text-white/40 text-sm">{song.genre} · {song.shares_sold}/{song.total_shares} shares sold</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-purple-400">${(song.shares_sold * song.price_per_share).toLocaleString()} raised</p>
            <p className="text-white/40">${song.price_per_share}/share</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsTab({ user }: { user: any }) {
  const { data: stats } = useQuery({
    queryKey: ["artist-analytics", user.id],
    queryFn: async () => {
      const { data: artist } = await supabase.from("artists").select("id").eq("user_id", user.id).single();
      if (!artist) return null;
      const { data: songs } = await supabase.from("songs").select("*").eq("artist_id", artist.id);
      if (!songs) return null;
      const totalRaised = songs.reduce((s: number, song: any) => s + song.shares_sold * song.price_per_share, 0);
      const totalStreams = songs.reduce((s: number, song: any) => s + song.total_streams, 0);
      const totalInvestors = await supabase.from("investments").select("investor_id", { count: "exact" }).in("song_id", songs.map(s => s.id));
      return { totalRaised, totalStreams, songCount: songs.length, investorCount: totalInvestors.count || 0 };
    }
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      {[
        { label: "Total Raised", value: `$${stats?.totalRaised?.toLocaleString() || "0"}` },
        { label: "Total Streams", value: `${((stats?.totalStreams || 0) / 1000).toFixed(1)}K` },
        { label: "Songs Published", value: stats?.songCount || 0 },
        { label: "Total Investors", value: stats?.investorCount || 0 },
      ].map(({ label, value }) => (
        <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <p className="text-white/50 text-sm mb-2">{label}</p>
          <p className="text-3xl font-bold text-purple-400">{value}</p>
        </div>
      ))}
    </div>
  );
}

function InvestorsTab({ user }: { user: any }) {
  const { data: investors = [] } = useQuery({
    queryKey: ["artist-investors", user.id],
    queryFn: async () => {
      const { data: artist } = await supabase.from("artists").select("id").eq("user_id", user.id).single();
      if (!artist) return [];
      const { data } = await supabase
        .from("investments")
        .select("*, songs(title), profiles(username)")
        .in("song_id", (await supabase.from("songs").select("id").eq("artist_id", artist.id)).data?.map(s => s.id) || [])
        .order("shares", { ascending: false });
      return data || [];
    }
  });

  return (
    <div>
      <p className="text-white/50 text-sm mb-4">{investors.length} total investors</p>
      <div className="space-y-2">
        {investors.map((inv: any) => (
          <div key={inv.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">
            <div>
              <p className="font-medium">{inv.profiles?.username || "Anonymous"}</p>
              <p className="text-white/40 text-sm">{inv.songs?.title}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">{inv.shares} shares</p>
              <p className="text-white/40 text-sm">${inv.total_paid.toFixed(2)} paid</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
