import { OrbitControls, Line, PerspectiveCamera } from "@react-three/drei";
import Agent from "./Agent";

const locations: Record<string, [number, number, number]> = {
  storyDesk: [-6, 0.5, -2],
  productionDesk: [0, 0.5, -2],
  marketingDesk: [6, 0.5, -2],
  lounge: [0, 0.5, 6],
};

export default function Office({ agents }: { agents: any[] }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 10, 15]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      <OrbitControls
        enableZoom={true}
        maxPolarAngle={Math.PI / 2.2}
      />

      {/* Central Meeting Area */}
      <mesh position={[0, 0, 6]}>
        <boxGeometry args={[6, 0.2, 4]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Story Room */}
      <Desk position={[-6, 0, -2]} label="Story" />

      {/* Production Room */}
      <Desk position={[0, 0, -2]} label="Production" />

      {/* Marketing Room */}
      <Desk position={[6, 0, -2]} label="Marketing" />

      {/* Pipeline Visual */}
      <Pipeline />

      {/* Agents */}
      {agents.map((agent, i) => {
        return (
          <Agent
            key={i}
            data={agent}
          />
        );
      })}
    </>
  );
}

function Desk({ position }: { position: [number, number, number], label: string }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[2, 0.2, 1]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    </group>
  );
}

function Pipeline() {
  return (
    <Line
      points={[
        [-6, 1, -2],
        [0, 1, -2],
        [6, 1, -2],
      ]}
      color="cyan"
      lineWidth={2}
    />
  );
}
