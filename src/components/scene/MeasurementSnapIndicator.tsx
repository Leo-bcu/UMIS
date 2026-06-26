import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { MeasurementSnapResult } from '../../lib/measurementPicking';

export function MeasurementSnapIndicator({
  point,
  snap,
  locale = 'zh-CN',
}: {
  point: THREE.Vector3 | null;
  snap: MeasurementSnapResult | null;
  locale?: 'zh-CN' | 'en-US';
}) {
  if (!point || !snap) return null;

  const color = snap.snapped ? '#00A676' : '#C99A2E';
  const label = snap.snapped
    ? locale === 'zh-CN'
      ? (snap.targetType === 'node' ? '已吸附测点' : '已吸附通道')
      : (snap.targetType === 'node' ? 'Snapped to checkpoint' : 'Snapped to channel')
    : locale === 'zh-CN'
      ? '自由点'
      : 'Free point';

  return (
    <group position={point} userData={{ noRaycast: true }}>
      <mesh>
        <ringGeometry args={[0.22, 0.3, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Html position={[0, 0.55, 0]} center>
        <div
          className="px-2 py-1 rounded border bg-white text-[9px] font-medium whitespace-nowrap shadow-sm"
          style={{ color, borderColor: `${color}55`, pointerEvents: 'none' }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}
