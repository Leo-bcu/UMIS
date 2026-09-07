import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useAllRobots } from '../../hooks/useRobots';
import { useSceneStore } from '../../store/useSceneStore';
import type { Robot, RobotStatus } from '../../types';
import { ROBOT_STATUS } from '../../lib/sceneColors';
import { computePlaybackState } from '../../lib/playbackEngine';

const STATUS_COLORS: Record<RobotStatus, string> = ROBOT_STATUS;

/** 按场景计算机器人标记大小 — 管道场景管径小，标记需同步缩小 */
function getMarkerScale(dataSource: string): number {
  if (dataSource === 'refinery') return 0.24;  // 化工场景管体已按演示比例缩放，机器人需保持可见
  if (dataSource === 'pipeline') return 0.26;   // 小口径管道按中心线更紧缩
  if (dataSource === 'nuclear') return 0.22;    // 反应堆管道中等偏小
  if (dataSource === 'underground') return 0.45; // 地下暗流保持可辨识但不夸张
  return 0.78; // 地下裂缝/油气/金矿保持清晰但不穿模
}

/**
 * 浮走式机器人（章鱼/水母式）— 地下暗流场景专用
 *
 * 视觉特征：
 * - 半透明伞盖（dome），随时间脉动收缩
 * - 6 条触须，随水流方向飘摆
 * - 整体上下浮动（水中漂浮）
 * - 软发光，非金属质感
 */
function FloatWalkerMarker({ robot, isFocused, markerScale }: { robot: Robot; isFocused: boolean; markerScale: number }) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const domeRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const tentacleRefs = useRef<THREE.Mesh[]>([]);

  const color = STATUS_COLORS[robot.status];

  // 触须基础几何 — 用细长锥体
  const tentacleGeo = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      points.push(new THREE.Vector3(0, -t * 0.5 * markerScale, 0));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 8, 0.03 * markerScale, 4, false);
  }, [markerScale]);

  // 6 条触须的角度
  const tentacleAngles = useMemo(
    () => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const phase = parseFloat(robot.id.replace(/\D/g, '')) * 0.37; // 每台机器人相位不同

    // 整体上下漂浮
    if (groupRef.current) {
      groupRef.current.position.y = robot.position[1] + Math.sin(t * 0.8 + phase) * 0.15 * markerScale;
      // 缓慢旋转，模拟水中调整方向
      groupRef.current.rotation.y = Math.sin(t * 0.3 + phase) * 0.5;
    }

    // 伞盖脉动 — 像水母收缩推进
    if (domeRef.current) {
      const pulse = 1 + Math.sin(t * 1.5 + phase) * 0.12;
      domeRef.current.scale.set(pulse, 1 + Math.sin(t * 1.5 + phase) * 0.08, pulse);
    }

    // 触须飘摆
    tentacleRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const sway = Math.sin(t * 1.2 + phase + i * 1.04) * 0.3;
      mesh.rotation.z = Math.cos(tentacleAngles[i]) * sway;
      mesh.rotation.x = Math.sin(tentacleAngles[i]) * sway;
    });

    if (coreRef.current) {
      const focusPulse = isFocused ? 1 + Math.sin(t * 5) * 0.18 : 1;
      coreRef.current.scale.setScalar(focusPulse);
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = isFocused ? 0.72 + Math.sin(t * 5) * 0.22 : opacity;
    }
  });

  const baseSize = (isFocused ? 0.24 : hovered ? 0.18 : 0.1) * markerScale;
  const opacity = robot.status === 'offline' ? 0.2 : 0.75;

  return (
    <group ref={groupRef} position={robot.position}>
      {/* 半透明伞盖 — 章鱼/水母式头部 */}
      <mesh
        ref={domeRef}
        userData={{ selectableKind: 'robot', robotId: robot.id }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[Math.max(0.12, baseSize * 1.3), 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={opacity * 0.7}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.2}
          metalness={0.0}
          transmission={0.4}
          thickness={0.3}
          ior={1.33}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        userData={{ selectableKind: 'robot', robotId: robot.id }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[Math.max(0.28, baseSize * 2.1), 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh userData={{ selectableKind: 'robot', robotId: robot.id }}>
        <sphereGeometry args={[Math.max(0.85, baseSize * 2.7), 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 中心核心光点 */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[baseSize * 0.4, 10, 10]} />
        <meshBasicMaterial color={isFocused ? '#FFE600' : color} transparent opacity={opacity} depthWrite={false} />
      </mesh>

      {/* 6 条触须 — 飘摆 */}
      {tentacleAngles.map((angle, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) tentacleRefs.current[i] = el; }}
          geometry={tentacleGeo}
          position={[
            Math.cos(angle) * baseSize * 0.7,
            -baseSize * 0.1,
            Math.sin(angle) * baseSize * 0.7,
          ]}
          rotation={[0, -angle, 0]}
        >
          <meshStandardMaterial
            color={color}
            transparent
            opacity={opacity * 0.5}
            emissive={color}
            emissiveIntensity={0.15}
            roughness={0.3}
          />
        </mesh>
      ))}

      {(hovered || isFocused) && (
        <Html distanceFactor={30} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(10,10,18,0.95)',
            border: `1px solid ${isFocused ? '#FFE600' : color}40`,
            borderRadius: '6px',
            padding: '4px 8px',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            color: isFocused ? '#FFE600' : '#E0E0E8',
            fontFamily: 'monospace',
          }}>
            {robot.id} · 浮走式
          </div>
        </Html>
      )}
    </group>
  );
}

function StandardRobotMarker({ robot, isFocused, markerScale, isRefinery }: { robot: Robot; isFocused: boolean; markerScale: number; isRefinery: boolean }) {
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLORS[robot.status];
  const pointRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!pointRef.current) return;
    const t = state.clock.elapsedTime;
    const mat = pointRef.current.material as THREE.MeshBasicMaterial;
    if (isFocused) {
      pointRef.current.scale.setScalar(1 + Math.sin(t * 5) * 0.18);
      mat.opacity = robot.status === 'offline' ? 0.55 : 0.78 + Math.sin(t * 5) * 0.2;
    } else {
      pointRef.current.scale.setScalar(1);
      mat.opacity = robot.status === 'offline' ? 0.35 : 0.98;
    }
  });

  const baseSize = (isFocused ? 0.24 : (hovered ? 0.18 : 0.1)) * markerScale;
  const visibleRadius = Math.max(isRefinery ? 0.075 : 0.08, baseSize);
  const haloRadius = Math.max(isRefinery ? 0.24 : 0.22, baseSize * 2.2);
  const pickRadius = Math.max(isRefinery ? 0.38 : 0.8, baseSize * 2.9);

  return (
    <group position={robot.position} renderOrder={isRefinery ? 8 : 0}>
      {/* 小光点 */}
      <mesh
        ref={pointRef}
        userData={{ selectableKind: 'robot', robotId: robot.id }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[visibleRadius, 12, 12]} />
        <meshBasicMaterial color={isFocused ? '#FFE600' : color} transparent opacity={robot.status === 'offline' ? 0.35 : 0.98} depthTest={!isRefinery} depthWrite={false} />
      </mesh>
      {isRefinery && (
        <mesh>
          <sphereGeometry args={[visibleRadius * 1.9, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={robot.status === 'offline' ? 0.12 : 0.2} depthTest={false} depthWrite={false} />
        </mesh>
      )}

      <mesh
        userData={{ selectableKind: 'robot', robotId: robot.id }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[haloRadius, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh userData={{ selectableKind: 'robot', robotId: robot.id }}>
        <sphereGeometry args={[pickRadius, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {(hovered || isFocused) && (
        <Html distanceFactor={30} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(10,10,18,0.95)',
            border: `1px solid ${isFocused ? '#FFE600' : color}40`,
            borderRadius: '6px',
            padding: '4px 8px',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            color: isFocused ? '#FFE600' : '#E0E0E8',
            fontFamily: 'monospace',
          }}>
            {robot.id}
          </div>
        </Html>
      )}
    </group>
  );
}

function RobotMarker({ robot, isFocused, markerScale, isRefinery }: { robot: Robot; isFocused: boolean; markerScale: number; isRefinery: boolean }) {
  if (robot.model === 'floatwalker') {
    return <FloatWalkerMarker robot={robot} isFocused={isFocused} markerScale={markerScale} />;
  }

  return <StandardRobotMarker robot={robot} isFocused={isFocused} markerScale={markerScale} isRefinery={isRefinery} />;
}

export function RobotMarkers() {
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const { data: allRobots, loading } = useAllRobots(dataSource, scenario);
  const focusedRobotId = useSceneStore((s) => s.focusedRobotId);
  const playbackProgress = useSceneStore((s) => s.playbackProgress);
  const playbackActive = useSceneStore((s) => s.playbackActive);
  const fractures = useSceneStore((s) => s.fractures);

  // 回放模式：用动画位置替代静态位置
  // 仅根据 playbackActive 判断（而非 progress >= 1），使播放结束后的最终帧保持一致（无突然弹出）
  const playbackRobots = useMemo(() => {
    if (!playbackActive || !allRobots || allRobots.length === 0) return null;
    return computePlaybackState(allRobots, fractures, playbackProgress).robots;
  }, [allRobots, fractures, playbackProgress, playbackActive]);

  if (loading || !allRobots) return null;

  const markerScale = getMarkerScale(dataSource);
  const effectiveRobots = playbackRobots ?? allRobots;
  const isRefinery = dataSource === 'refinery';

  return (
    <group>
      {effectiveRobots.map((robot) => (
        <RobotMarker
          key={robot.id}
          robot={robot}
          isFocused={focusedRobotId === robot.id}
          markerScale={markerScale}
          isRefinery={isRefinery}
        />
      ))}
    </group>
  );
}
