import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import Office from "./components/Office";
import AgentPanel from "./components/AgentPanel";
import { useAgentData } from "./hooks/useAgentData";

export default function App() {
  const agents = useAgentData();

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Canvas>
        <Suspense fallback={null}>
          <Office agents={agents} />
        </Suspense>
      </Canvas>
      <AgentPanel />
    </div>
  );
}
