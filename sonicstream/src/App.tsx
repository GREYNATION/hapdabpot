import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Navbar from "./components/Navbar";
import AudioPlayer from "./components/player/AudioPlayer";
import DiscoverPage from "./pages/DiscoverPage";
import PortfolioPage from "./pages/PortfolioPage";
import RoyaltiesPage from "./pages/RoyaltiesPage";
import ArtistDashboard from "./pages/ArtistDashboard";
import SongPage from "./pages/SongPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";

const queryClient = new QueryClient();

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
          <Navbar user={user} />
          <Routes>
            <Route path="/" element={<DiscoverPage user={user} />} />
            <Route path="/song/:id" element={<SongPage user={user} />} />
            <Route path="/portfolio" element={user ? <PortfolioPage user={user} /> : <Navigate to="/auth" />} />
            <Route path="/royalties" element={user ? <RoyaltiesPage user={user} /> : <Navigate to="/auth" />} />
            <Route path="/artist" element={user ? <ArtistDashboard user={user} /> : <Navigate to="/auth" />} />
            <Route path="/profile" element={user ? <ProfilePage user={user} /> : <Navigate to="/auth" />} />
            <Route path="/auth" element={<AuthPage />} />
          </Routes>
          <AudioPlayer />
        </div>
        <Toaster theme="dark" position="bottom-right" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
