import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Wallet, Music } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage({ user }: { user: any }) {
  const navigate = useNavigate();

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user.id).single();
      return data;
    }
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    }
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/");
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Profile card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-purple-900 rounded-2xl flex items-center justify-center text-2xl font-bold">
            {user.email?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-lg">{profile?.username || user.email?.split("@")[0]}</p>
            <p className="text-white/50 text-sm">{user.email}</p>
            <p className="text-white/30 text-xs">Joined {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white/50 text-xs mb-1">Investments</p>
            <p className="font-bold">{wallet?.total_deposited ? "Active" : "0"}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white/50 text-xs mb-1">Following</p>
            <p className="font-bold">0</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white/50 text-xs mb-1">Invested</p>
            <p className="font-bold">${wallet?.total_deposited?.toFixed(2) || "0.00"}</p>
          </div>
        </div>
      </div>

      {/* Wallet */}
      <div className="bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/20 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={16} className="text-purple-400" />
          <p className="text-white/50 text-sm uppercase tracking-wider">Wallet Balance</p>
        </div>
        <p className="text-4xl font-bold mb-4">${wallet?.balance?.toFixed(2) || "0.00"}</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/5 rounded-xl p-3 text-sm">
            <p className="text-white/40 text-xs">Total Earned</p>
            <p className="font-medium text-green-400">${wallet?.total_earned?.toFixed(4) || "0.0000"}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-sm">
            <p className="text-white/40 text-xs">Total Withdrawn</p>
            <p className="font-medium">${wallet?.total_withdrawn?.toFixed(2) || "0.00"}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
            + Deposit
          </button>
          <button className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
            Withdraw
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => navigate("/artist")}
          className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm transition-colors"
        >
          <Music size={16} className="text-purple-400" />
          Artist Studio
        </button>
        <button
          onClick={() => navigate("/portfolio")}
          className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm transition-colors"
        >
          <User size={16} className="text-purple-400" />
          My Portfolio
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
