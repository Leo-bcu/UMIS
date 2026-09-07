import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';

export function HighlightRegion() {
  const ringRef = useRef<THREE.Mesh>(null);
  const pointRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const pointMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const highlightRegion = useSceneStore((s) => s.highlightRegion);

  useFrame((state) => {
    if (ringRef.current && pointRef.current && matRef.current && pointMatRef.current) {
      ringRef.current.position.set(...highlightRegion.position);
      pointRef.current.position.set(...highlightRegion.position);
      if (highlightRegion.active) {
        const pulse = Math.sin(state.clock.elapsedTime * 6) * 0.5 + 0.5;
        const radius = Math.min(Math.max(highlightRegion.radius * 0.28, 0.45), 1.4);
        ringRef.current.scale.setScalar(radius * (0.92 + pulse * 0.16));
        matRef.current.opacity = 0.45 + pulse * 0.25;
        pointRef.current.scale.setScalar(1 + pulse * 0.22);
        pointMatRef.current.opacity = 0.85 + pulse * 0.15;
      } else {
        matRef.current.opacity = 0;
        pointMatRef.current.opacity = 0;
      }
    }
  });

  return (
    <group>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} renderOrder={4}>
        <ringGeometry args={[0.72, 1, 36]} />
        <meshBasicMaterial
          ref={matRef}
          color="#FFE600"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={pointRef} renderOrder={4}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial
          ref={pointMatRef}
          color="#FFE600"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
