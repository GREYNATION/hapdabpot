import { Html } from "@react-three/drei";

export default function Agent({ data }: { data: any }) {
  const color =
    data.status === "working"
      ? "green"
      : data.status === "failed"
      ? "red"
      : "gray";

  const positionMap: Record<string, [number, number, number]> = {
    story: [-6, 0, -2],     // Left desk
    scene: [-3, 0, -2],     // Inserted between desks
    production: [0, 0, -2], // Middle desk
    assembly: [3, 0, -2],   // Inserted between desks
    posting: [6, 0, -2],    // Right Desk (Marketing)
  };

  return (
    <group position={positionMap[data.agent?.toLowerCase()] || [0, 0, 0]}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      
      {data.task && (
        <Html position={[0, 1.5, 0]} center>
          <div className="label" style={{ background: "black", color: "white", padding: "5px 10px", borderRadius: "5px", whiteSpace: "nowrap" }}>
            {data.task}
          </div>
        </Html>
      )}
    </group>
  );
}
