import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "./playerStore";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { Play, Pause, SkipBack, SkipForward, Volume2, Video, Lock, X } from "lucide-react";

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const {
    currentSong, isPlaying, progress, duration, volume,
    pause, resume, setProgress, setDuration, setVolume, next, prev, showVideo, setShowVideo
  } = usePlayerStore();

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });
  }, []);

  // Get user's investment in this song
  const { data: investment } = useQuery({
    queryKey: ["investment", userId, currentSong?.id],
    enabled: !!userId && !!currentSong,
    queryFn: async () => {
      const { data } = await supabase
        .from("investments")
        .select("shares")
        .eq("investor_id", userId)
        .eq("song_id", currentSong!.id)
        .single();
      return data;
    }
  });

  const userShares = investment?.shares || 0;
  const canWatchVideo = userShares >= 10;
  const canSeeExclusive = userShares >= 25;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (currentSong.audio_url) {
      audio.src = currentSong.audio_url;
      audio.volume = volume;
      if (isPlaying) audio.play().catch(console.error);
    }
  }, [currentSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    isPlaying ? audio.play().catch(console.error) : audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const handleTimeUpdate = () => {
    if (audioRef.current) setProgress(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!currentSong) return null;

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={next}
      />

      {/* Video Modal */}
      {showVideo && canWatchVideo && currentSong.video_url && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
          <button
            onClick={() => setShowVideo(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white"
          >
            <X size={28} />
          </button>
          {canSeeExclusive && (
            <div className="absolute top-4 left-4 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs px-3 py-1.5 rounded-full">
              Major Investor — Exclusive Access
            </div>
          )}
          <video
            src={currentSong.video_url}
            autoPlay
            controls
            className="max-w-5xl w-full rounded-xl"
          />
        </div>
      )}

      {/* Player bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0d0d14]/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 z-40">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          {/* Song info */}
          <div className="flex items-center gap-3 w-56 flex-shrink-0">
            <div className="w-10 h-10 bg-purple-900 rounded-lg overflow-hidden flex-shrink-0">
              {currentSong.cover_url && (
                <img src={currentSong.cover_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{currentSong.title}</p>
              <p className="text-xs text-white/40 truncate">{(currentSong as any).artists?.name}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-center gap-4">
              <button onClick={prev} className="text-white/50 hover:text-white transition-colors">
                <SkipBack size={18} />
              </button>
              <button
                onClick={() => isPlaying ? pause() : resume()}
                className="w-9 h-9 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button onClick={next} className="text-white/50 hover:text-white transition-colors">
                <SkipForward size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-xs text-white/40 w-8 text-right">{formatTime(progress)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={progress}
                onChange={handleSeek}
                className="flex-1 accent-purple-500"
              />
              <span className="text-xs text-white/40 w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 w-48 justify-end flex-shrink-0">
            {/* Video button */}
            {currentSong.video_url && (
              <button
                onClick={() => canWatchVideo ? setShowVideo(true) : null}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  canWatchVideo
                    ? "bg-purple-600/30 text-purple-400 hover:bg-purple-600/50"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
                }`}
                title={canWatchVideo ? "Watch video" : "Invest 10+ shares to unlock video"}
              >
                {canWatchVideo ? <Video size={13} /> : <Lock size={13} />}
                Video
              </button>
            )}

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-white/40" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="w-20 accent-purple-500"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
