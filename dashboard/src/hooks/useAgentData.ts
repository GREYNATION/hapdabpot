import { useEffect, useState } from "react";

export function useAgentData() {
  const [agents, setAgents] = useState<any[]>([
    { agent: "story", status: "working", task: "Writing Episode 2" },
    { agent: "scene", status: "idle", task: "Waiting..." },
    { agent: "production", status: "idle", task: "Waiting..." },
  ]);

  useEffect(() => {
    // Dynamically detect host to support both Local (3141) and Railway (8080)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;
    
    log(`[Neural Link] Connecting to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle Heartbeats (keep system alive)
        if (data.type === 'heartbeat') return;

        setAgents((prev) => {
          const incomingObj = {
            agent: data.agent,      
            task: data.message || "Active",    
            status: data.type === 'status' ? 'working' : 'idle',
            lastActive: Date.now()
          };

          // Filter out old entry and add fresh one
          const updated = prev.filter((a) => a.agent.toLowerCase() !== data.agent.toLowerCase());
          return [...updated, incomingObj];
        });
      } catch (err) {
        console.error("Neural sync error:", err);
      }
    };

    return () => ws.close();
  }, []);

  function log(msg: string) {
    console.log(`%c[Brain] ${msg}`, "color: #facc15; font-weight: bold;");
  }

  return agents;
}
