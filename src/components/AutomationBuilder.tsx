import React, { useState } from "react";

/**
 * HADES Funnel / Hapdabot Automation System Builder
 * 
 * This component provides an interactive interface for businesses to architect
 * their AI multi-agent workforce. It allows selecting industries, service tiers,
 * and configuring specific agents (CSR, Assistant, Office Mgr, Sales Rep).
 */

const AGENTS = [
  {
    id: "csr",
    name: "CSR",
    subtitle: "INBOUND VOICE AI BOT",
    color: "#00d4ff",
    glowColor: "rgba(0,212,255,0.4)",
    trigger: "CUSTOMER CALLS",
    note: "or forward to office",
    duties: ["Answering Calls", "Rollover Calls", "Afterhours", "Booking Hotline"],
    icon: "📞",
    emoji: "🤖",
    tier: "starter",
  },
  {
    id: "assistant",
    name: "ASSISTANT",
    subtitle: "CHAT AI",
    color: "#a855f7",
    glowColor: "rgba(168,85,247,0.4)",
    trigger: "TEXT or EMAIL",
    note: "or notify the office",
    duties: ["Email", "SMS", "Facebook", "Instagram", "Web Chat"],
    icon: "💬",
    emoji: "🦾",
    tier: "starter",
    badge: "FREE",
  },
  {
    id: "office",
    name: "OFFICE MGR",
    subtitle: "OUTBOUND VOICE AI BOT",
    color: "#3b82f6",
    glowColor: "rgba(59,130,246,0.4)",
    trigger: "CUSTOMER RECEIVED CALL",
    note: null,
    duties: ["Calls Customers Monthly", "Schedule Service"],
    icon: "🏢",
    emoji: "🔵",
    tier: "pro",
  },
  {
    id: "sales",
    name: "SALES REP",
    subtitle: "OUTBOUND VOICE AI BOT",
    color: "#22c55e",
    glowColor: "rgba(34,197,94,0.4)",
    trigger: "CUSTOMER RECEIVED CALL",
    note: null,
    duties: ["Calls New Leads", "Qualifies Prospects", "Schedules Appointments"],
    icon: "💰",
    emoji: "🟢",
    tier: "pro",
  },
];

const LEAD_SOURCES = [
  "Facebook", "Google", "Instagram", "TikTok", "YouTube",
  "Door Knock", "Referral", "Yard Sign", "Direct Mail", "Cold Call",
  "Website", "Zillow",
];

const INDUSTRIES = [
  "Home Services", "Real Estate", "HVAC", "Plumbing", "Roofing",
  "Insurance", "Med Spa", "Dental", "Auto Repair", "Law Firm",
  "Landscaping", "Solar",
];

const TIERS = [
  {
    name: "STARTER",
    price: "$497/mo",
    agents: ["CSR", "ASSISTANT"],
    color: "#00d4ff",
    desc: "Inbound only — never miss a call or message",
  },
  {
    name: "PRO",
    price: "$997/mo",
    agents: ["CSR", "ASSISTANT", "OFFICE MGR", "SALES REP"],
    color: "#a855f7",
    desc: "Full inbound + outbound AI workforce",
  },
  {
    name: "HADES",
    price: "$1,997/mo",
    agents: ["CSR", "ASSISTANT", "OFFICE MGR", "SALES REP", "+ CRM", "+ Lead Funnel"],
    color: "#f97316",
    desc: "Complete autonomous system with CRM & lead pipeline",
  },
];

interface AgentCardProps {
  agent: typeof AGENTS[0];
  active: boolean;
  onClick: (id: string) => void;
}

function AgentCard({ agent, active, onClick }: AgentCardProps) {
  return (
    <div
      onClick={() => onClick(agent.id)}
      style={{
        background: active
          ? `linear-gradient(135deg, ${agent.glowColor}, rgba(0,0,0,0.8))`
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? agent.color : "rgba(255,255,255,0.1)"}`,
        borderRadius: 16,
        padding: "20px 16px",
        cursor: "pointer",
        transition: "all 0.3s ease",
        boxShadow: active ? `0 0 30px ${agent.glowColor}` : "none",
        position: "relative" as "relative",
        overflow: "hidden",
      }}
    >
      {agent.badge && (
        <div style={{
          position: "absolute" as "absolute", top: 10, right: 10,
          background: "#22c55e", color: "#000",
          fontSize: 10, fontWeight: 900, padding: "2px 8px",
          borderRadius: 20, letterSpacing: 1,
        }}>
          {agent.badge}
        </div>
      )}
      <div style={{ fontSize: 32, marginBottom: 8 }}>{agent.icon}</div>
      <div style={{
        color: agent.color, fontSize: 20, fontWeight: 900,
        fontFamily: "'Black Han Sans', sans-serif", letterSpacing: 2,
      }}>
        {agent.name}
      </div>
      <div style={{
        color: "rgba(255,255,255,0.6)", fontSize: 10,
        letterSpacing: 2, marginBottom: 10, fontWeight: 700,
      }}>
        {agent.subtitle}
      </div>
      <div style={{
        display: "inline-block",
        background: "rgba(255,255,255,0.08)",
        border: `1px solid ${agent.color}44`,
        borderRadius: 6, padding: "3px 10px",
        fontSize: 10, color: agent.color, letterSpacing: 1,
        marginBottom: 10,
      }}>
        {agent.trigger}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {agent.duties.map(d => (
          <div key={d} style={{
            fontSize: 11, color: "rgba(255,255,255,0.5)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: agent.color }} />
            {d}
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 12,
        fontSize: 10, fontWeight: 700, letterSpacing: 2,
        color: agent.tier === "starter" ? "#00d4ff" : "#a855f7",
        textTransform: "uppercase" as "uppercase",
      }}>
        {agent.tier} tier
      </div>
    </div>
  );
}

function FlowDiagram({ selectedAgents, industry }: { selectedAgents: string[], industry: string }) {
  const active = (id: string) => selectedAgents.includes(id);
  return (
    <div style={{
      background: "#050510",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: 24,
      fontFamily: "'Black Han Sans', sans-serif",
    }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          display: "inline-block",
          background: "linear-gradient(90deg, #f97316, #ef4444)",
          borderRadius: 8, padding: "6px 20px",
          fontSize: 12, fontWeight: 900, letterSpacing: 3, color: "#fff",
        }}>
          {industry?.toUpperCase() || "YOUR BUSINESS"} — AI AUTOMATION SYSTEM
        </div>
      </div>

      {/* Lead Sources */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{
          display: "inline-flex", gap: 6, flexWrap: "wrap",
          justifyContent: "center", maxWidth: 500, margin: "0 auto",
        }}>
          {["Facebook", "Google", "Referral", "Website", "Cold Call"].map(src => (
            <div key={src} style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6, padding: "3px 10px",
              fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 1,
            }}>{src}</div>
          ))}
        </div>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 6 }}>↓</div>
        <div style={{
          display: "inline-block",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8, padding: "6px 24px",
          fontSize: 11, color: "#fff", letterSpacing: 2, fontWeight: 700,
        }}>NEW LEAD FUNNEL</div>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 6 }}>↓</div>
        <div style={{
          display: "inline-block",
          background: "rgba(255,165,0,0.15)",
          border: "1px solid rgba(255,165,0,0.4)",
          borderRadius: 8, padding: "4px 16px",
          fontSize: 10, color: "#ffa500", letterSpacing: 2,
        }}>WHAT HAPPENED?</div>
      </div>

      {/* Agent Row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10, marginTop: 12,
      }}>
        {AGENTS.map(agent => (
          <div key={agent.id} style={{
            textAlign: "center" as "center",
            opacity: active(agent.id) ? 1 : 0.25,
            transition: "opacity 0.3s",
          }}>
            <div style={{
              border: `1px solid ${active(agent.id) ? agent.color : "rgba(255,255,255,0.1)"}`,
              borderRadius: 8, padding: "4px 6px",
              fontSize: 9, color: active(agent.id) ? agent.color : "rgba(255,255,255,0.3)",
              letterSpacing: 1, marginBottom: 4,
            }}>
              {agent.trigger}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 900, color: active(agent.id) ? "#fff" : "rgba(255,255,255,0.3)",
              letterSpacing: 1,
            }}>
              {agent.name}
            </div>
            <div style={{
              fontSize: 9, color: active(agent.id) ? agent.color : "rgba(255,255,255,0.2)",
              letterSpacing: 1, marginBottom: 6,
            }}>
              {agent.subtitle}
            </div>
            <div style={{
              fontSize: 28,
              filter: active(agent.id) ? `drop-shadow(0 0 10px ${agent.color})` : "none",
            }}>
              {agent.emoji === "🔵" ? "🤖" : agent.emoji === "🟢" ? "🦿" : agent.emoji}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>↓</div>
        <div style={{
          display: "inline-block",
          background: "linear-gradient(90deg, #ef4444, #dc2626)",
          borderRadius: 8, padding: "8px 24px",
          fontSize: 11, fontWeight: 900, color: "#fff", letterSpacing: 2, marginTop: 6,
        }}>
          SCHEDULE DIRECTLY INTO CRM / PROJECT MGMT SOFTWARE
        </div>
      </div>
    </div>
  );
}

export default function AutomationBuilder() {
  const [industry, setIndustry] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTier, setSelectedTier] = useState("PRO");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(["csr", "assistant", "office", "sales"]);
  const [generating, setGenerating] = useState(false);
  const [proposal, setProposal] = useState("");
  const [tab, setTab] = useState("builder");

  const toggleSource = (src: string) => {
    setSelectedSources(prev =>
      prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
    );
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const generateProposal = async () => {
    setGenerating(true);
    setTab("proposal");
    const tier = TIERS.find(t => t.name === selectedTier);
    try {
      // Note: In production, this should call your backend orchestrator
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Generate a HADES Funnel proposal for a ${industry} business. Tier: ${selectedTier}. Agents: ${selectedAgents.join(", ")}.`,
        })
      });
      const data = await res.json();
      setProposal(data.reply || "Proposal generation initiated. Check your Telegram bot.");
    } catch {
      // Fallback
      setProposal(`🚀 **AUTOMATION PROPOSAL: ${industry.toUpperCase()}**\n\n🎯 **ROI Focus**: By deploying the ${selectedTier} tier, your business eliminates up to 80% of manual lead handling overhead. Our AI agents respond to new leads in under 30 seconds, increasing conversion rates by up to 400%.\n\n🦾 **The Workforce**:\n${selectedAgents.map(a => `- **${a.toUpperCase()}**: Automating your ${AGENTS.find(ag => ag.id === a)?.subtitle}`).join("\n")}\n\n💰 **Investment**: ${tier?.price} / month\n\n✅ **Next Steps**: Click the link in your dashboard to authorize GoHighLevel integration and start provisioning your first voice agents.`);
    }
    setGenerating(false);
  };

  const tier = TIERS.find(t => t.name === selectedTier);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#030308",
      color: "#fff",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, #0a0a1a 0%, #030308 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            fontSize: 22, fontWeight: 900, letterSpacing: 3,
            fontFamily: "'Black Han Sans', sans-serif",
            background: "linear-gradient(90deg, #f97316, #ef4444)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            ⚡ HAPDABOT
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 3 }}>
            AI AUTOMATION SYSTEM BUILDER
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["builder", "proposal"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab === t ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${tab === t ? "#f97316" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 8, padding: "6px 16px",
              color: tab === t ? "#f97316" : "rgba(255,255,255,0.4)",
              fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
              textTransform: "uppercase" as "uppercase",
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 900, margin: "0 auto" }}>

        {tab === "builder" && (
          <>
            {/* Industry Select */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)",
                marginBottom: 10, fontWeight: 700,
              }}>
                01 — SELECT INDUSTRY
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {INDUSTRIES.map(ind => (
                  <button key={ind} onClick={() => setIndustry(ind)} style={{
                    background: industry === ind ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${industry === ind ? "#f97316" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 8, padding: "6px 14px",
                    color: industry === ind ? "#f97316" : "rgba(255,255,255,0.5)",
                    fontSize: 12, cursor: "pointer", fontWeight: 600,
                    transition: "all 0.2s",
                  }}>
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* Tier Select */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)",
                marginBottom: 10, fontWeight: 700,
              }}>
                02 — SELECT TIER
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {TIERS.map(t => (
                  <div key={t.name} onClick={() => setSelectedTier(t.name)} style={{
                    background: selectedTier === t.name
                      ? `linear-gradient(135deg, ${t.color}22, rgba(0,0,0,0.6))`
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${selectedTier === t.name ? t.color : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 12, padding: "16px 14px",
                    cursor: "pointer", transition: "all 0.3s",
                    boxShadow: selectedTier === t.name ? `0 0 20px ${t.color}44` : "none",
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: t.color, letterSpacing: 2 }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: "4px 0" }}>
                      {t.price}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                      {t.desc}
                    </div>
                    {t.agents.map(a => (
                      <div key={a} style={{
                        fontSize: 9, color: t.color,
                        letterSpacing: 1, lineHeight: 1.8,
                      }}>✓ {a}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Config */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)",
                marginBottom: 10, fontWeight: 700,
              }}>
                03 — CONFIGURE AGENTS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {AGENTS.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    active={selectedAgents.includes(agent.id)}
                    onClick={toggleAgent}
                  />
                ))}
              </div>
            </div>

            {/* Lead Sources */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)",
                marginBottom: 10, fontWeight: 700,
              }}>
                04 — LEAD SOURCES
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LEAD_SOURCES.map(src => (
                  <button key={src} onClick={() => toggleSource(src)} style={{
                    background: selectedSources.includes(src) ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${selectedSources.includes(src) ? "#a855f7" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 8, padding: "5px 12px",
                    color: selectedSources.includes(src) ? "#a855f7" : "rgba(255,255,255,0.4)",
                    fontSize: 11, cursor: "pointer",
                  }}>
                    {src}
                  </button>
                ))}
              </div>
            </div>

            {/* System Preview */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)",
                marginBottom: 10, fontWeight: 700,
              }}>
                05 — SYSTEM PREVIEW
              </div>
              <FlowDiagram selectedAgents={selectedAgents} industry={industry} />
            </div>

            {/* CTA */}
            <button
              onClick={generateProposal}
              disabled={!industry}
              style={{
                width: "100%",
                background: industry
                  ? "linear-gradient(90deg, #f97316, #ef4444)"
                  : "rgba(255,255,255,0.05)",
                border: "none", borderRadius: 12,
                padding: "16px",
                color: industry ? "#fff" : "rgba(255,255,255,0.2)",
                fontSize: 14, fontWeight: 900, letterSpacing: 3,
                cursor: industry ? "pointer" : "not-allowed",
                fontFamily: "'Black Han Sans', sans-serif",
                boxShadow: industry ? "0 0 40px rgba(249,115,22,0.3)" : "none",
              }}
            >
              ⚡ GENERATE CLIENT PROPOSAL
            </button>
          </>
        )}

        {tab === "proposal" && (
          <div>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16, padding: 24, marginBottom: 20,
            }}>
              <div style={{
                fontSize: 11, letterSpacing: 3, color: "#f97316",
                fontWeight: 700, marginBottom: 16,
              }}>
                CLIENT PROPOSAL — {industry?.toUpperCase()} / {selectedTier} TIER / {tier?.price}
              </div>
              {generating ? (
                <div style={{
                  textAlign: "center" as "center", padding: 40,
                  color: "rgba(255,255,255,0.3)", fontSize: 13,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                  Generating proposal...
                </div>
              ) : proposal ? (
                <div style={{
                  fontSize: 13, lineHeight: 1.8,
                  color: "rgba(255,255,255,0.8)",
                  whiteSpace: "pre-wrap" as "pre-wrap",
                }}>
                  {proposal}
                </div>
              ) : (
                <div style={{ textAlign: "center" as "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>
                  Configure your system in the Builder tab first, then generate a proposal.
                </div>
              )}
            </div>

            {!generating && proposal && (
              <div style={{
                background: "rgba(249,115,22,0.08)",
                border: "1px solid rgba(249,115,22,0.2)",
                borderRadius: 12, padding: 16,
              }}>
                <div style={{ fontSize: 11, color: "#f97316", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
                  PRICING SUMMARY
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Tier</span>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{selectedTier}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Monthly Retainer</span>
                  <span style={{ color: "#f97316", fontWeight: 900, fontSize: 16 }}>{tier?.price}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Setup Fee (1x)</span>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>
                    {selectedTier === "STARTER" ? "$997" : selectedTier === "PRO" ? "$1,997" : "$3,997"}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => setTab("builder")}
              style={{
                width: "100%", marginTop: 16,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, padding: "12px",
                color: "rgba(255,255,255,0.5)", fontSize: 12,
                fontWeight: 700, letterSpacing: 2, cursor: "pointer",
              }}
            >
              ← BACK TO BUILDER
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
