import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { generateMockMonitors } from '../../data/robotDataGenerator';

export function MonitorMarkers() {
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const monitors = useMemo(() => generateMockMonitors(dataSource, scenario), [dataSource, scenario]);
  const openMonitorDetail = useSceneStore((s) => s.openMonitorDetail);

  return (
    <group renderOrder={6}>
      {monitors.map((monitor) => (
        <MonitorMarker key={monitor.id} monitor={monitor} onClick={() => openMonitorDetail(monitor)} />
      ))}
    </group>
  );
}

function MonitorMarker({ monitor, onClick }: { monitor: ReturnType<typeof generateMockMonitors>[number]; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={monitor.position} onClick={onClick} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <mesh>
        <sphereGeometry args={[hovered ? 0.24 : 0.18, 10, 10]} />
        <meshBasicMaterial color="#2E90FA" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.5, 24]} />
        <meshBasicMaterial color="#2E90FA" transparent opacity={0.24} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
