import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { NUCLEAR_IDENTITY } from '../../lib/sceneColors';

/**
 * 核反应堆安全壳厂房 — PWR 压水堆结构渲染
 *
 * 无岩层环境。包含：
 * - 安全壳穹顶（半透明圆柱+半球）
 * - 反应堆压力容器 (RPV)
 * - 4个蒸汽发生器 (SG)
 * - 4个主泵 (RCP)
 * - 稳压器 (PRZ)
 */
export function ReactorContainment() {
  const visible = useSceneStore((s) => s.layers.rockMass);
  const dataSource = useSceneStore((s) => s.dataSource);

  // 仅在核反应堆模式显示
  if (!visible || dataSource !== 'nuclear') return null;

  // 设备布局
  const SG_DIST = 16, RCP_DIST = 9;
  const DIRS = [
    { dx: 0, dz: 1 }, { dx: 1, dz: 0 },
    { dx: 0, dz: -1 }, { dx: -1, dz: 0 },
  ];

  return (
    <group>
      {/* 安全壳外壳 — 仅线框，不画实体球避免遮挡 */}
      <lineSegments position={[0, -5, 0]}>
        <edgesGeometry args={[new THREE.CylinderGeometry(24, 24, 30, 24, 1, true)]} />
        <lineBasicMaterial color={NUCLEAR_IDENTITY.containment} transparent opacity={0.25} depthWrite={false} />
      </lineSegments>
      {/* 安全壳穹顶 — 仅纬线环 */}
      {[8, 14, 20, 24].map((r, i) => (
        <mesh key={`dome-ring-${i}`} position={[0, 10 + Math.sqrt(576 - r * r), 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, 0.08, 4, 48]} />
          <meshBasicMaterial color={NUCLEAR_IDENTITY.containment} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      ))}

      {/* 地面 */}
      <mesh position={[0, -20, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[24, 48]} />
        <meshStandardMaterial color="#0F0F16" transparent opacity={0.5} roughness={0.95} metalness={0.05} />
      </mesh>
      {/* 地面网格环 */}
      <mesh position={[0, -19.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[23.8, 24, 64]} />
        <meshBasicMaterial color={NUCLEAR_IDENTITY.containment} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* 反应堆压力容器 (RPV) */}
      <group position={[0, -14, 0]}>
        {/* RPV 筒体 */}
        <mesh>
          <cylinderGeometry args={[4, 4.5, 14, 16]} />
          <meshStandardMaterial color={NUCLEAR_IDENTITY.rpv} roughness={0.5} metalness={0.6} transparent opacity={0.35} depthWrite={false} />
        </mesh>
        {/* RPV 顶盖 */}
        <mesh position={[0, 7.5, 0]}>
          <sphereGeometry args={[4.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3]} />
          <meshStandardMaterial color={NUCLEAR_IDENTITY.rpv} roughness={0.5} metalness={0.6} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>

      {/* 4个蒸汽发生器 (SG) */}
      {DIRS.map((d, i) => {
        const x = SG_DIST * d.dx, z = SG_DIST * d.dz;
        return (
          <group key={`sg-${i}`} position={[x, -10, z]}>
            {/* SG 筒体 */}
            <mesh>
              <cylinderGeometry args={[3, 3.5, 18, 16]} />
              <meshStandardMaterial color={NUCLEAR_IDENTITY.sg} roughness={0.5} metalness={0.5} transparent opacity={0.3} depthWrite={false} />
            </mesh>
            {/* SG 顶部 */}
            <mesh position={[0, 10, 0]}>
              <sphereGeometry args={[3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3]} />
              <meshStandardMaterial color={NUCLEAR_IDENTITY.sg} roughness={0.5} metalness={0.5} transparent opacity={0.3} depthWrite={false} />
            </mesh>
          </group>
        );
      })}

      {/* 4个主泵 (RCP) */}
      {DIRS.map((d, i) => {
        const x = RCP_DIST * d.dx, z = RCP_DIST * d.dz;
        return (
          <group key={`rcp-${i}`} position={[x, -14, z]}>
            <mesh>
              <cylinderGeometry args={[2, 2.5, 4, 12]} />
              <meshStandardMaterial color={NUCLEAR_IDENTITY.rcp} roughness={0.4} metalness={0.7} transparent opacity={0.35} depthWrite={false} />
            </mesh>
          </group>
        );
      })}

      {/* 稳压器 (PRZ) */}
      <group position={[8, -2, 8]}>
        <mesh>
          <cylinderGeometry args={[2, 2, 8, 12]} />
          <meshStandardMaterial color={NUCLEAR_IDENTITY.prz} roughness={0.4} metalness={0.6} transparent opacity={0.3} depthWrite={false} />
        </mesh>
        <mesh position={[0, 5, 0]}>
          <sphereGeometry args={[2.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3]} />
          <meshStandardMaterial color={NUCLEAR_IDENTITY.prz} roughness={0.4} metalness={0.6} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
