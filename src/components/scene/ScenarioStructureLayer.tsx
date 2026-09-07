import * as THREE from 'three';
import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useSceneStore } from '../../store/useSceneStore';
import { useAllRobots } from '../../hooks/useRobots';
import { generateMockMonitors } from '../../data/robotDataGenerator';
import type { Monitor } from '../../types';
import { computePlaybackState } from '../../lib/playbackEngine';
import { GEO_IDENTITY, INTERACTION, PIPE_IDENTITY, STATUS } from '../../lib/sceneColors';

function TransparentShell({
  color,
  opacity,
}: {
  color: string;
  opacity: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      transparent
      opacity={opacity}
      roughness={0.88}
      metalness={0.04}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  );
}

function HazardMarker({
  position,
  radius,
  color,
}: {
  position: [number, number, number];
  radius: number;
  color: string;
}) {
  const ringRadius = Math.min(Math.max(radius * 0.12, 0.22), 0.48);
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[ringRadius * 0.78, ringRadius, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh renderOrder={3}>
        <sphereGeometry args={[Math.max(0.12, ringRadius * 0.18), 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.82} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MineRoadway({
  points,
  radius = 1.15,
  color = GEO_IDENTITY.sedimentary,
  opacity = 0.56,
  selectableId,
  selectableName,
}: {
  points: [number, number, number][];
  radius?: number;
  color?: string;
  opacity?: number;
  selectableId?: string;
  selectableName?: string;
}) {
  const { shellGeo, coreGeo, proxyGeo } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    const steps = Math.max(28, points.length * 10);
    const shell = new THREE.TubeGeometry(curve, steps, radius * 0.74, 14, false);
    const core = new THREE.TubeGeometry(curve, steps, radius * 0.46, 14, false);
    const proxy = new THREE.TubeGeometry(curve, steps, Math.max(radius * 0.95, radius + 0.18), 12, false);
    shell.computeVertexNormals();
    core.computeVertexNormals();
    proxy.computeVertexNormals();
    return { shellGeo: shell, coreGeo: core, proxyGeo: proxy };
  }, [points, radius]);

  const selectableData = selectableId ? { selectableKind: 'coalStructure', coalStructureId: selectableId, coalStructureName: selectableName } : undefined;
  return (
    <group renderOrder={2}>
      <mesh geometry={shellGeo} userData={{ noRaycast: true }}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={Math.min(opacity, 0.72)}
          roughness={0.96}
          metalness={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={coreGeo} userData={{ noRaycast: true }}>
        <meshBasicMaterial color="#0E0A08" transparent opacity={0.62} depthWrite={false} />
      </mesh>
      {selectableData && (
        <mesh geometry={proxyGeo} userData={selectableData} renderOrder={6}>
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}

function MineBackWall() {
  const beds = useMemo(() => {
    return [-3, -18, -36, -52].map((y, index) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([
        -52, y, -18.6,
        -34, y + 1.6, -18.6,
        -12, y - 0.8, -18.6,
        8, y + 1.2, -18.6,
        28, y - 0.6, -18.6,
        52, y + 1.0, -18.6,
      ], 3));
      return { key: `coal-wall-bed-${index}`, geo, opacity: index === 1 ? 0.42 : 0.26, color: index === 1 ? '#12100D' : '#5B4430' };
    });
  }, []);

  return (
    <group renderOrder={1}>
      {beds.map((bed) => (
        <primitive key={bed.key} object={new THREE.Line(bed.geo)} renderOrder={2}>
          <lineBasicMaterial color={bed.color} transparent opacity={bed.opacity} depthWrite={false} />
        </primitive>
      ))}
    </group>
  );
}

function RealCoalHighwallReference() {
  const source = useLoader(OBJLoader, '/models/coal-mine/fieg-highwall-reference.obj');

  const model = useMemo(() => {
    const cloned = source.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeVertexNormals();
        child.material = new THREE.MeshStandardMaterial({
          color: GEO_IDENTITY.sedimentary,
          roughness: 0.96,
          metalness: 0,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
      }
    });

    cloned.position.sub(center);
    const maxSide = Math.max(size.x, size.y, size.z);
    cloned.scale.setScalar(maxSide > 0 ? 68 / maxSide : 1);
    return cloned;
  }, [source]);

  return (
    <group position={[0, -30, -34]} rotation={[-0.08, 0.22, 0.03]} renderOrder={1}>
      <primitive object={model} />
    </group>
  );
}

function MineChamberVolume({
  position,
  size,
  color,
  rotation = [0, 0, 0],
  opacity = 0.42,
  selectableId,
  selectableName,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  opacity?: number;
  selectableId?: string;
  selectableName?: string;
}) {
  const geometry = useMemo(() => {
    const [width, height, depth] = size;
    const outline = Array.from({ length: 28 }, (_, index) => {
      const a = (index / 28) * Math.PI * 2;
      const rough = 1 + Math.sin(a * 3.1 + width * 0.07) * 0.07 + Math.cos(a * 5.2 + depth * 0.04) * 0.04;
      return [Math.cos(a) * 0.5 * rough, Math.sin(a) * 0.42 * rough] as const;
    });
    const vertices: number[] = [];
    outline.forEach(([x, z], index) => {
      const roofWarp = Math.sin(index * 0.73 + width * 0.17) * height * 0.025;
      vertices.push(x * width, -height * 0.5, z * depth, x * width, height * 0.5 + roofWarp, z * depth);
    });
    const indices: number[] = [];
    for (let i = 0; i < outline.length; i += 1) {
      const next = (i + 1) % outline.length;
      const floorA = i * 2;
      const roofA = floorA + 1;
      const floorB = next * 2;
      const roofB = floorB + 1;
      indices.push(floorA, floorB, roofA, roofA, floorB, roofB);
    }
    for (let i = 1; i < outline.length - 1; i += 1) {
      indices.push(0, i * 2, (i + 1) * 2);
      indices.push(1, (i + 1) * 2 + 1, i * 2 + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [size]);

  return (
    <group position={position} rotation={rotation} renderOrder={2} userData={selectableId ? { selectableKind: 'coalStructure', coalStructureId: selectableId, coalStructureName: selectableName } : undefined}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          roughness={0.98}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <primitive object={new THREE.EdgesGeometry(geometry, 32)} attach="geometry" />
        <lineBasicMaterial color="#D0A066" transparent opacity={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MineSupportSet({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} renderOrder={4}>
      <mesh position={[-0.72, 0.58, 0]}>
        <boxGeometry args={[0.16, 1.2, 0.16]} />
        <meshBasicMaterial color="#B28A55" transparent opacity={0.78} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0.72, 0.58, 0]}>
        <boxGeometry args={[0.16, 1.2, 0.16]} />
        <meshBasicMaterial color="#B28A55" transparent opacity={0.78} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[1.64, 0.14, 0.18]} />
        <meshBasicMaterial color="#C8A36A" transparent opacity={0.82} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

export const COAL_STRUCTURE_DEFINITIONS = [
  { id: 'G-000', name: '地表入井巷道', kind: 'decline' as const, points: [[-48, 12, -26], [-44, 5, -23], [-38, -4, -20], [-30, -14, -16], [-22, -22, -12]] as [number, number, number][] },
  { id: 'G-001', name: '主运输巷道', kind: 'mainRoadway' as const, points: [[-22, -22, -12], [-10, -24, -10], [4, -26, -8], [18, -28, -4], [34, -31, 2], [50, -34, 10]] as [number, number, number][] },
  { id: 'G-002', name: '平行辅助巷道', kind: 'returnAirway' as const, points: [[-26, -18, 5], [-12, -21, 6], [6, -25, 10], [24, -31, 18], [44, -38, 30]] as [number, number, number][] },
  { id: 'G-003', name: '次级联络巷道', kind: 'lowerRoadway' as const, points: [[0, -26, -8], [-5, -35, 2], [-8, -44, 15], [-4, -52, 27], [4, -59, 38]] as [number, number, number][] },
  { id: 'G-004', name: '偏置平行巷道', kind: 'goafEdge' as const, points: [[16, -36, 18], [25, -44, 28], [38, -52, 36], [50, -58, 34]] as [number, number, number][] },
] as const;

function CoalMineWorkings() {
  const fractures = useSceneStore((s) => s.fractures);
  const playbackProgress = useSceneStore((s) => s.playbackProgress);
  const playbackActive = useSceneStore((s) => s.playbackActive);
  const { data: robots } = useAllRobots('fracture', 'coal');
  const revealRatios = useMemo(() => {
    if (!playbackActive || !robots || robots.length === 0 || fractures.length === 0) return null;
    return computePlaybackState(robots, fractures, playbackProgress).revealRatios;
  }, [fractures, playbackActive, playbackProgress, robots]);

  const visible = (ids: string[], threshold = 0.08) => {
    if (!revealRatios) return true;
    return ids.some((id) => (revealRatios[id] ?? 0) >= threshold);
  };
  const anyVisible = (threshold = 0.02) => {
    if (!revealRatios) return true;
    return Object.values(revealRatios).some((ratio) => ratio >= threshold);
  };

  const decline: [number, number, number][] = [//斜下方走廊
    [-48, 12, -26],
    [-44, 5, -23],
    [-38, -4, -20],
    [-30, -14, -16],
    [-22, -22, -12],
  ];
  const mainRoadway: [number, number, number][] = [//这部分是主隧道，实的
    [-22, -22, -12],
    [-10, -24, -10],
    [4, -26, -8],
    [18, -28, -4],
    [34, -31, 2],
    [50, -34, 10],
  ];
  const lowerRoadway: [number, number, number][] = [//斜腔隧道
    [0, -26, -8],
    [-5, -35, 2],
    [-8, -44, 15],
    [-4, -52, 27],
    [4, -59, 38],
  ];
  const returnAirway: [number, number, number][] = [//平行主巷道
    [-26, -18, 5],
    [-12, -21, 6],
    [6, -25, 10],
    [24, -31, 18],
    [44, -38, 30],
  ];
  const goafEdge: [number, number, number][] = [
    [16, -36, 18],
    [25, -44, 28],
    [38, -52, 36],
    [50, -58, 34],
  ];
  const roomPillars: [number, number, number][] = [
    [-12, -27, -4], [-4, -28, -3], [5, -29, -2], [14, -30, -1],
    [-11, -39, 10], [-3, -41, 13], [6, -43, 16], [16, -45, 20],
  ];
  const supports: [number, number, number][] = [
    [-36, -8, -19], [-24, -21, -12], [-8, -24, -10], [10, -27, -7],
    [26, -30, -1], [42, -33, 7], [-6, -43, 17], [4, -57, 36],
  ];
  const mainTraceLine = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      -48, 12, -26,
      -38, -4, -20,
      -22, -22, -12,
      4, -26, -8,
      34, -31, 2,
      50, -34, 10,
    ], 3));
    return new THREE.Line(geo);
  }, []);

  return (
    <group renderOrder={1}>
      {anyVisible() && <RealCoalHighwallReference />}
      {anyVisible() && <MineBackWall />}
      {visible(['F-019']) && <MineChamberVolume position={[8, -24, -5]} size={[24, 7.5, 13]} color="#7A5B3E" rotation={[0.08, 0.05, -0.04]} opacity={0.5} />}
      {visible(['F-018', 'F-005', 'F-011']) && <MineChamberVolume position={[32, -44, 29]} size={[34, 10, 24]} color="#763D2E" rotation={[0.1, 0.18, -0.08]} opacity={0.46} />}
      {visible(['F-020', 'F-003']) && <MineChamberVolume position={[-8, -34, 22]} size={[21, 7.5, 16]} color="#6B4A34" rotation={[0.06, -0.12, 0.02]} opacity={0.44} />}
      {visible(['F-021', 'F-006']) && <MineChamberVolume position={[18, -46, 27]} size={[20, 6.2, 12]} color="#365F5C" rotation={[0.04, 0.24, -0.05]} opacity={0.42} />}
      {visible(['F-022', 'F-010']) && <MineChamberVolume position={[2, -52, 36]} size={[12, 5.2, 9]} color="#385D60" rotation={[0.02, -0.08, 0.04]} opacity={0.44} />}
      {visible(['F-023', 'F-009']) && <MineChamberVolume position={[45, -43, -31]} size={[15, 5.4, 9]} color="#6E3C2F" rotation={[0.05, 0.2, 0.03]} opacity={0.45} />}

      <mesh position={[-46, 11.2, -25.5]} rotation={[0.03, 0, -0.08]} renderOrder={2}>
        <boxGeometry args={[14, 0.7, 8]} />
        <meshBasicMaterial color="#6B5437" transparent opacity={0.38} depthWrite={false} />
      </mesh>

      <MineRoadway points={COAL_STRUCTURE_DEFINITIONS[0].points} radius={2.0} color="#C28A55" opacity={0.95} selectableId={COAL_STRUCTURE_DEFINITIONS[0].id} selectableName={COAL_STRUCTURE_DEFINITIONS[0].name} />
      <MineRoadway points={COAL_STRUCTURE_DEFINITIONS[1].points} radius={2.15} color="#B88954" opacity={0.92} selectableId={COAL_STRUCTURE_DEFINITIONS[1].id} selectableName={COAL_STRUCTURE_DEFINITIONS[1].name} />
      <MineRoadway points={COAL_STRUCTURE_DEFINITIONS[2].points} radius={1.45} color="#806548" opacity={0.78} selectableId={COAL_STRUCTURE_DEFINITIONS[2].id} selectableName={COAL_STRUCTURE_DEFINITIONS[2].name} />
      <MineRoadway points={COAL_STRUCTURE_DEFINITIONS[3].points} radius={1.65} color="#A27043" opacity={0.88} selectableId={COAL_STRUCTURE_DEFINITIONS[3].id} selectableName={COAL_STRUCTURE_DEFINITIONS[3].name} />
      <MineRoadway points={COAL_STRUCTURE_DEFINITIONS[4].points} radius={1.15} color="#C0523B" opacity={0.9} selectableId={COAL_STRUCTURE_DEFINITIONS[4].id} selectableName={COAL_STRUCTURE_DEFINITIONS[4].name} />

      {visible(['F-000'], 0.01) && (
        <primitive
          renderOrder={5}
          object={mainTraceLine}
        >
          <lineBasicMaterial color="#E4B76D" transparent opacity={0.36} depthWrite={false} />
        </primitive>
      )}

      {roomPillars.map((position, index) => (
        visible(index < 4 ? ['F-001'] : ['F-003'], 0.12) && <mesh key={`coal-pillar-${index}`} position={position} rotation={[0.1, 0.16, -0.1]}>
          <boxGeometry args={[1.55, 2.2, 1.55]} />
          <meshBasicMaterial color="#231913" transparent opacity={0.86} depthWrite={false} depthTest={false} />
        </mesh>
      ))}
      {/* 地表井口/投放点 */}
      {visible(['F-000'], 0.01) && (
        <>
          <mesh position={[-48, 10.0, -28]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.12, 0.08, 8, 28]} />
            <meshBasicMaterial color="#F0B642" transparent opacity={0.78} depthWrite={false} depthTest={false} />
          </mesh>
          <mesh position={[-48, 10.45, -28]}>
            <boxGeometry args={[2.2, 0.8, 2.2]} />
            <meshBasicMaterial color="#3A2E22" />
          </mesh>
        </>
      )}
      {supports.map((position, index) => (
        visible(index < 2 ? ['F-000'] : index < 6 ? ['F-001'] : ['F-003'], 0.12)
          ? <MineSupportSet key={position.join(',')} position={position} />
          : null
      ))}
      {/* 煤矿异常点：只在对应采空区、裂隙带、涌水区被机器人扫描到后显影 */}
      {visible(['F-018', 'F-005'], 0.24) && <mesh position={[18, -36, 18]}>
        <sphereGeometry args={[0.68, 10, 10]} />
        <meshBasicMaterial color={STATUS.caution} transparent opacity={0.82} depthWrite={false} />
      </mesh>}
      {visible(['F-021', 'F-006'], 0.24) && <mesh position={[10, -44, 26]}>
        <sphereGeometry args={[0.52, 10, 10]} />
        <meshBasicMaterial color={GEO_IDENTITY.waterGlow} transparent opacity={0.72} depthWrite={false} />
      </mesh>}
      {visible(['F-018', 'F-011'], 0.28) && <mesh position={[30, -50, 31]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshBasicMaterial color={STATUS.warning} transparent opacity={0.68} depthWrite={false} />
      </mesh>}
    </group>
  );
}

function GoldStopes() {
  return (
    <group renderOrder={1}>
      <mesh position={[0, -2, 0]}>
        <boxGeometry args={[100, 32, 74]} />
        <TransparentShell color="#3A2D21" opacity={0.13} />
      </mesh>
      {[
        [-34, -9, -12, 10, 28, 11],
        [-2, -7, 3, 12, 30, 13],
        [28, -9, 16, 9, 24, 10],
      ].map(([x, y, z, w, h, d]) => (
        <mesh
          key={`${x}-${z}`}
          position={[x, y, z]}
          rotation={[0.08, 0, 0.05]}
        >
          <boxGeometry args={[w, h, d]} />
          <TransparentShell color="#6E5133" opacity={0.12} />
        </mesh>
      ))}
      <mesh position={[0, -5, 2]}>
        <boxGeometry args={[86, 5, 10]} />
        <TransparentShell color="#1A1D22" opacity={0.08} />
      </mesh>
      <HazardMarker position={[14, -2, 13]} radius={4.4} color={STATUS.caution} />
      <HazardMarker position={[-26, -6, -12]} radius={3.2} color={STATUS.warning} />
    </group>
  );
}

function OilReservoirCutaway() {
  return (
    <group renderOrder={1}>
      <mesh position={[0, -10, 0]}>
        <boxGeometry args={[122, 38, 92]} />
        <TransparentShell color="#3D2A1C" opacity={0.12} />
      </mesh>
      <mesh position={[0, -9, 0]} rotation={[0, 0, -0.04]}>
        <boxGeometry args={[92, 9, 54]} />
        <meshBasicMaterial color={GEO_IDENTITY.waterGlow} transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <mesh position={[-5, -2, 5]} rotation={[0, 0, 0.05]}>
        <boxGeometry args={[76, 7, 42]} />
        <meshBasicMaterial color={PIPE_IDENTITY.flammable} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <HazardMarker position={[12, 4, 8]} radius={5} color={STATUS.warning} />
      <mesh position={[-29, -4, -11]} rotation={[0, 0.25, 0]}>
        <boxGeometry args={[18, 1.4, 30]} />
        <meshBasicMaterial color={INTERACTION.hover} transparent opacity={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

function UndergroundAquifer() {
  return (
    <group renderOrder={1}>
      <mesh position={[0, -18, 0]}>
        <boxGeometry args={[132, 88, 112]} />
        <TransparentShell color="#31241A" opacity={0.1} />
      </mesh>
      <HazardMarker position={[2, -19, -2]} radius={3.8} color={STATUS.caution} />
    </group>
  );
}

function MonitorRing({ monitors }: { monitors: Monitor[] }) {
  return (
    <group renderOrder={6}>
      {monitors.map((monitor, index) => (
        <group key={monitor.id} position={monitor.position}>
          <mesh>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshBasicMaterial color={monitor.status === 'warning' ? STATUS.warning : STATUS.caution} transparent opacity={0.8} depthWrite={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.58 + (index % 3) * 0.06, 24]} />
            <meshBasicMaterial color={monitor.status === 'online' ? STATUS.success : STATUS.warning} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.6, 10]} />
            <meshBasicMaterial color="#CDBA8A" transparent opacity={0.9} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function PipelineInspectionBay() {
  return (
    <group renderOrder={1}>
      <mesh position={[0, -8.2, 0]}>
        <boxGeometry args={[142, 9, 30]} />
        <TransparentShell color="#202830" opacity={0.08} />
      </mesh>
      <mesh position={[-35, -4, 0]}>
        <boxGeometry args={[18, 14, 22]} />
        <TransparentShell color="#465565" opacity={0.12} />
      </mesh>
      <mesh position={[35, -4, 0]}>
        <boxGeometry args={[18, 14, 22]} />
        <TransparentShell color="#465565" opacity={0.1} />
      </mesh>
      {[-46, -23, 0, 23, 46].map((x) => (
        <mesh key={x} position={[x, -1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.55, 0.08, 10, 48]} />
          <meshStandardMaterial color={PIPE_IDENTITY.hotAlloy} roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      <HazardMarker position={[8, -1.5, 0.25]} radius={2.3} color={STATUS.warning} />
      <HazardMarker position={[44, -1.2, -0.2]} radius={1.8} color={STATUS.danger} />
    </group>
  );
}

export function ScenarioStructureLayer() {
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);

  if (dataSource === 'nuclear' || dataSource === 'refinery') return null;
  if (dataSource === 'pipeline') return <PipelineInspectionBay />;
  if (dataSource === 'underground') return <UndergroundAquifer />;
  if (dataSource === 'fracture' && scenario === 'coal') return <CoalMineWorkings />;
  if (dataSource === 'fracture' && scenario === 'gold') return <GoldStopes />;
  if (dataSource === 'fracture' && scenario === 'oil') return <OilReservoirCutaway />;
  return null;
}
