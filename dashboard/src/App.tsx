import { Canvas } from "@react-three/fiber";
import { Suspense, useState } from "react";
import Office from "./components/Office";
import AgentPanel from "./components/AgentPanel";
import TradingDashboard from "./components/TradingDashboard";
import { useAgentData } from "./hooks/useAgentData";
import { Zap, Building2 } from "lucide-react";

type Tab = "office" | "trading";

export default function App() {
  const agents = useAgentData();
  const [activeTab, setActiveTab] = useState<Tab>("office");

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#0a0f1e" }}>
      {/* Top Nav */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 20px",
          background: "rgba(10,15,30,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <span style={{ fontWeight: 800, fontSize: 18, color: "#fff", letterSpacing: "0.04em", marginRight: 8 }}>
          HapdaBot
        </span>

        {/* Tabs */}
        {(
          [
            { id: "office", label: "3D Office", icon: <Building2 size={14} /> },
            { id: "trading", label: "Master Trader", icon: <Zap size={14} /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s",
              background: activeTab === tab.id ? "rgba(234,179,8,0.18)" : "transparent",
              color: activeTab === tab.id ? "#facc15" : "rgba(255,255,255,0.45)",
              boxShadow: activeTab === tab.id ? "0 0 0 1px rgba(234,179,8,0.35)" : "none",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content: 3D Office */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingTop: 52,
          display: activeTab === "office" ? "block" : "none",
        }}
      >
        <Canvas>
          <Suspense fallback={null}>
            <Office agents={agents} />
          </Suspense>
        </Canvas>
        <AgentPanel />
      </div>

      {/* Content: Trading Dashboard */}
      {activeTab === "trading" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            paddingTop: 52,
            overflowY: "auto",
          }}
        >
          <TradingDashboard />
        </div>
      )}
    </div>
  );
}
