import { useEffect, useState } from "react";

export function useAgentData() {
  const [agents, setAgents] = useState<any[]>([
    { agent: "story", status: "working", task: "Writing Episode 2" },
    { agent: "scene", status: "idle", task: "Waiting..." },
    { agent: "production", status: "idle", task: "Waiting..." },
  ]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        setAgents((prev) => {
          // Normalize incoming data to match the React components
          const incomingObj = {
            agent: data.agent,      
            task: data.message,    
            status: data.status,
            progress: data.progress,
            target: data.target || "lounge"
          };

          const updated = prev.filter((a) => a.agent.toLowerCase() !== data.agent.toLowerCase());
          return [...updated, incomingObj];
        });
      } catch (err) {
        console.error("WebSocket payload error:", err);
      }
    };

    return () => ws.close();
  }, []);

  return agents;
}
