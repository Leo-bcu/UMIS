import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';

function ShellMaterial({ color = '#8192A8', opacity = 0.18 }: { color?: string; opacity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      transparent
      opacity={opacity}
      roughness={0.58}
      metalness={0.38}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  );
}

function EdgeCylinder({
  radius,
  height,
  color = '#D7DEE8',
  opacity = 0.32,
}: {
  radius: number;
  height: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <lineSegments>
      <edgesGeometry args={[new THREE.CylinderGeometry(radius, radius, height, 36, 2, true)]} />
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
}

function HorizontalVessel({
  position,
  radius,
  length,
  color,
}: {
  position: [number, number, number];
  radius: number;
  length: number;
  color: string;
}) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[radius, radius, length, 48, 2, true]} />
        <ShellMaterial color={color} opacity={0.16} />
      </mesh>
      <EdgeCylinder radius={radius} height={length} />
      <mesh position={[0, length / 2, 0]}>
        <sphereGeometry args={[radius, 32, 16]} />
        <ShellMaterial color={color} opacity={0.11} />
      </mesh>
      <mesh position={[0, -length / 2, 0]}>
        <sphereGeometry args={[radius, 32, 16]} />
        <ShellMaterial color={color} opacity={0.11} />
      </mesh>
    </group>
  );
}

function VerticalVessel() {
  return (
    <group position={[18, 13, 0]}>
      <mesh>
        <cylinderGeometry args={[5.6, 5.6, 32, 56, 3, true]} />
        <ShellMaterial color="#7D8A9B" opacity={0.17} />
      </mesh>
      <EdgeCylinder radius={5.6} height={32} />
      <mesh position={[0, 16, 0]}>
        <sphereGeometry args={[5.6, 36, 18]} />
        <ShellMaterial color="#7D8A9B" opacity={0.1} />
      </mesh>
      <mesh position={[0, -16, 0]}>
        <sphereGeometry args={[5.6, 36, 18]} />
        <ShellMaterial color="#7D8A9B" opacity={0.1} />
      </mesh>
      <mesh position={[-5.8, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.25, 0.08, 10, 40]} />
        <meshStandardMaterial color="#E8C36B" roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh position={[1.4, -8.5, -1.8]}>
        <sphereGeometry args={[2.1, 24, 16]} />
        <meshBasicMaterial color="#FF6B35" transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HeatExchangerBank() {
  const zs = [-12, -4, 4, 12];
  return (
    <group>
      {zs.map((z, index) => (
        <group key={z}>
          <HorizontalVessel position={[-24, -9 + index * 0.65, z]} radius={1.75} length={24} color="#7587A0" />
          <mesh position={[-36.5, -9 + index * 0.65, z]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[1.75, 0.08, 10, 40]} />
            <meshStandardMaterial color="#D8B45A" roughness={0.52} metalness={0.28} />
          </mesh>
        </group>
      ))}
      <mesh position={[-20, -9.2, -4]}>
        <sphereGeometry args={[2.4, 24, 16]} />
        <meshBasicMaterial color="#FFD166" transparent opacity={0.13} depthWrite={false} />
      </mesh>
    </group>
  );
}

function StorageTank() {
  return (
    <group>
      <HorizontalVessel position={[-4, -4.2, 0]} radius={6.3} length={18} color="#6F7F92" />
      <mesh position={[-10.5, -4.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[2.1, 0.12, 12, 48]} />
        <meshStandardMaterial color="#E8C36B" roughness={0.5} metalness={0.22} />
      </mesh>
      <mesh position={[-2, -8.4, -1.3]}>
        <sphereGeometry args={[2.8, 28, 18]} />
        <meshBasicMaterial color="#FF8A3D" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <mesh position={[2.5, -5.8, 2.2]}>
        <sphereGeometry args={[1.5, 20, 12]} />
        <meshBasicMaterial color="#E53935" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

function AccessEnvelope() {
  return (
    <group>
      <mesh position={[-9, -4, 0]}>
        <boxGeometry args={[60, 38, 36]} />
        <meshBasicMaterial color="#2B3444" wireframe transparent opacity={0.08} />
      </mesh>
      <mesh position={[-28, -7.8, 0]}>
        <boxGeometry args={[2.2, 10, 28]} />
        <meshBasicMaterial color="#F3C969" transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function RefineryVessels() {
  const visible = useSceneStore((s) => s.layers.rockMass);
  const dataSource = useSceneStore((s) => s.dataSource);

  if (!visible || dataSource !== 'refinery') return null;

  return (
    <group renderOrder={1}>
      <AccessEnvelope />
      <HeatExchangerBank />
      <StorageTank />
      <VerticalVessel />
    </group>
  );
}

