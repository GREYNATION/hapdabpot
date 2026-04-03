import { Link, useLocation } from "react-router-dom";
import { Headphones, TrendingUp, DollarSign, Music, User } from "lucide-react";

const NAV = [
  { path: "/", label: "Discover", icon: Headphones },
  { path: "/portfolio", label: "Portfolio", icon: TrendingUp },
  { path: "/royalties", label: "Royalties", icon: DollarSign },
  { path: "/artist", label: "For Artists", icon: Music },
];

export default function Navbar({ user }: { user: any }) {
  const { pathname } = useLocation();

  return (
    <nav className="sticky top-0 z-30 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center">
            <Headphones size={16} />
          </div>
          SonicStream
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                pathname === path
                  ? "bg-purple-600/20 text-purple-400"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>

        <Link
          to={user ? "/profile" : "/auth"}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm transition-colors"
        >
          <User size={15} />
          {user ? user.email?.split("@")[0] : "Sign In"}
        </Link>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden flex border-t border-white/10">
        {NAV.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors ${
              pathname === path ? "text-purple-400" : "text-white/40"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
