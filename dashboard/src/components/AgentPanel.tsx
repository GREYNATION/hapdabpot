import { useEffect, useState } from "react";

export default function AgentPanel() {
  const [agent, setAgent] = useState<any>(null);

  useEffect(() => {
    const handleAgentClick = (e: any) => {
      setAgent(e.detail);
    };

    window.addEventListener("agentClick", handleAgentClick);
    return () => {
      window.removeEventListener("agentClick", handleAgentClick);
    };
  }, []);

  if (!agent) return null;

  return (
    <div className="panel" style={{ position: "absolute", top: 20, right: 20, background: "rgba(0,0,0,0.8)", padding: 20, borderRadius: 8, color: "white" }}>
      <h2>{agent.name}</h2>
      <p>Status: {agent.status}</p>
      <p>Task: {agent.task}</p>
    </div>
  );
}
