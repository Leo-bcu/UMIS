import { useMemo, useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import type { Fracture, FractureNode, ScenarioType, SensorReading } from '../../types';
import { SCENARIO_BASE_COLOR, STATUS, INTERACTION, ENTRANCE, GEO_IDENTITY, NUCLEAR_IDENTITY } from '../../lib/sceneColors';
import { computePlaybackState } from '../../lib/playbackEngine';
import { useAllRobots } from '../../hooks/useRobots';

/**
 * 裂缝网络 — 逼真岩层裂缝渲染
 *
 * 真实裂缝特征：
 * - 扁平不规则裂面（不是圆管）
 * - 两侧岩壁有错动（位移）
 * - 裂面有粗糙纹理
 * - 从岩体表面有明确入口
 * - 分支从主裂缝节点分出
 *
 * 渲染方式：每条裂缝 = 两个不规则面（上下盘）+ 边缘线
 */

// 渗透率颜色映射：蓝(低) → 绿 → 黄 → 红(高)
function permeabilityColor(perm: number): THREE.Color {
  const t = Math.max(0, Math.min(1, perm / 4.0)); // 0~4 mD
  const color = new THREE.Color();
  if (t < 0.25) {
    const lt = t / 0.25;
    color.setRGB(0.1 + lt * 0.1, 0.2 + lt * 0.4, 0.9 - lt * 0.3);
  } else if (t < 0.5) {
    const lt = (t - 0.25) / 0.25;
    color.setRGB(0.2 + lt * 0.2, 0.6 + lt * 0.3, 0.6 - lt * 0.4);
  } else if (t < 0.75) {
    const lt = (t - 0.5) / 0.25;
    color.setRGB(0.4 + lt * 0.6, 0.9 - lt * 0.1, 0.2);
  } else {
    const lt = (t - 0.75) / 0.25;
    color.setRGB(1.0, 0.8 - lt * 0.6, 0.1);
  }
  return color;
}

// 应力颜色映射：绿(低) → 黄 → 红(高)
function stressColor(stress: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (stress - 5) / 20)); // 5~25 MPa
  const color = new THREE.Color();
  if (t < 0.5) {
    const lt = t / 0.5;
    color.setRGB(lt * 1.0, 0.7 + lt * 0.2, 0.1);
  } else {
    const lt = (t - 0.5) / 0.5;
    color.setRGB(1.0, 0.9 - lt * 0.7, 0.1);
  }
  return color;
}

// 颜色映射
function valueToColor(
  value: number, min: number, max: number, threshold?: number
): THREE.Color {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const color = new THREE.Color();
  if (threshold !== undefined && value >= threshold) {
    color.setRGB(1, 0.2 + (1 - t) * 0.3, 0.1);
  } else if (t < 0.33) {
    color.setRGB(0.1, 0.5 + t * 1.5, 0.9 - t * 0.5);
  } else if (t < 0.66) {
    const lt = (t - 0.33) / 0.33;
    color.setRGB(lt * 1.0, 0.85, 0.3);
  } else {
    const lt = (t - 0.66) / 0.34;
    color.setRGB(1.0, 0.85 - lt * 0.65, 0.1);
  }
  return color;
}

function getSensorMetric(
  sensors: SensorReading, scenario: string
): { value: number; min: number; max: number; threshold?: number } {
  if (scenario === 'coal') return { value: sensors.ch4_pct, min: 0, max: 5, threshold: 1.5 };
  if (scenario === 'gold') return { value: sensors.microseismic_count, min: 0, max: 30, threshold: 15 };
  if (scenario === 'pipeline') return { value: sensors.rock_strength_mpa, min: 0, max: 60, threshold: 20 };
  if (scenario === 'nuclear') return { value: sensors.ch4_pct, min: 0, max: 100, threshold: 25 };
  if (scenario === 'refinery') return { value: sensors.h2s_ppm, min: 0, max: 150, threshold: 50 };
  if (scenario === 'underground') return { value: sensors.permeability_md, min: 0, max: 10000, threshold: 5000 };
  return { value: sensors.pore_pressure_mpa, min: 5, max: 35, threshold: 30 };
}

export function FractureNetwork() {
  const visible = useSceneStore((s) => s.layers.fractures);
  const fractures = useSceneStore((s) => s.fractures);
  const selectedFracture = useSceneStore((s) => s.selectedFracture);
  const scenario = useSceneStore((s) => s.scenario);
  const highlightedFractureIds = useSceneStore((s) => s.highlightedFractureIds);
  const playbackProgress = useSceneStore((s) => s.playbackProgress);
  const playbackActive = useSceneStore((s) => s.playbackActive);
  const dataSource = useSceneStore((s) => s.dataSource);
  const { data: allRobots } = useAllRobots(dataSource, scenario);

  // 回放：揭示比例由机器人实际位置驱动（机器人爬到哪里，管道才渲染到哪里）
  // 与 RobotMarkers 完全共享同一逻辑 — computePlaybackState 既是真相源
  const revealRatios = useMemo(() => {
    if (!playbackActive || !allRobots || allRobots.length === 0) return null;
    return computePlaybackState(allRobots, fractures, playbackProgress).revealRatios;
  }, [allRobots, fractures, playbackProgress, playbackActive]);

  if (!visible || fractures.length === 0) return null;

  const isPipeMode = scenario === 'pipeline' || scenario === 'nuclear' || scenario === 'refinery';
  const isUndergroundMode = scenario === 'underground';
  const isCoalWorkings = scenario === 'coal';

  const renderChannel = (fracture: Fracture) => {
    const isSelected = selectedFracture?.id === fracture.id;
    const isHighlighted =
      highlightedFractureIds === null ? null : highlightedFractureIds.includes(fracture.id);
    const revealRatio = revealRatios?.[fracture.id] ?? 1;

    // 回放模式且该裂缝尚未被发现 → 跳过
    if (revealRatios && revealRatio <= 0) return null;

    if (isCoalWorkings) {
      // 煤矿：按 morphology 分发到 矿坑腔体 / 巷道 / 内部裂隙
      if (fracture.morphology === 'cavity') {
        return (
          <CoalCavityMesh
            key={fracture.id}
            fracture={fracture}
            isSelected={isSelected}
            isHighlighted={isHighlighted}
            revealRatio={revealRatio}
          />
        );
      }
      if (fracture.morphology === 'tunnel') {
        return (
          <CoalTunnelMesh
            key={fracture.id}
            fracture={fracture}
            isSelected={isSelected}
            isHighlighted={isHighlighted}
            revealRatio={revealRatio}
          />
        );
      }
      // fracture（矿坑内裂隙/注浆孔）— 煤矿里应是细线/细管，不画成漂浮大面片。
      return (
        <CoalTunnelMesh
          key={fracture.id}
          fracture={fracture}
          isSelected={isSelected}
          isHighlighted={isHighlighted}
          revealRatio={revealRatio}
        />
      );
    }
    if (isUndergroundMode) {
      return (
        <UndergroundChannelMesh
          key={fracture.id}
          fracture={fracture}
          isSelected={isSelected}
          isHighlighted={isHighlighted}
          revealRatio={revealRatio}
        />
      );
    }
    if (isPipeMode) {
      return (
        <PipeMesh
          key={fracture.id}
          fracture={fracture}
          isSelected={isSelected}
          isHighlighted={isHighlighted}
          scenario={scenario}
          revealRatio={revealRatio}
        />
      );
    }
    return (
      <FractureSurface
        key={fracture.id}
        fracture={fracture}
        isSelected={isSelected}
        isHighlighted={isHighlighted}
        scenario={scenario}
        revealRatio={revealRatio}
      />
    );
  };

  return (
    <group>
      {fractures.map(renderChannel)}
      {/* 入口标记 — 仅在真实地表/可部署入口的主管道起点显示
          深层连通管道（如地下暗流的 Trunk3）起点在岩层深处，机器人无法从此处部署，不显示入口 */}
      {(() => {
        const mains = fractures.filter(f => f.type === 'main');
        if (mains.length === 0) return null;
        const startYs = mains.map(f => f.path[0][1]);
        const surfaceY = Math.max(...startYs);
        const ySpan = surfaceY - Math.min(...startYs);
        // 阈值 = max(5, Y跨度的25%)，只有近地表的主管道起点才视为可部署入口
        const surfaceThreshold = Math.max(5, ySpan * 0.25);
        return mains
          .filter(f => f.path[0][1] >= surfaceY - surfaceThreshold)
          .map((fracture) => {
            const revealRatio = revealRatios?.[fracture.id] ?? 1;
            if (revealRatios && revealRatio <= 0) return null;
            if (isCoalWorkings) return null;
            return isPipeMode ? (
              <PipeEntrance key={`entrance-${fracture.id}`} position={fracture.path[0]} name={fracture.name} />
            ) : isUndergroundMode ? (
              <UndergroundEntrance key={`entrance-${fracture.id}`} position={fracture.path[0]} name={fracture.name} />
            ) : (
              <FractureEntrance key={`entrance-${fracture.id}`} position={fracture.path[0]} name={fracture.name} />
            );
          });
      })()}
      {/* 测点标记 — 回放模式下隐藏（太多会影响性能） */}
      {!revealRatios && fractures.map((fracture) =>
        fracture.nodes.map((node) => (
          <FractureNodeMarker
            key={node.id}
            node={node}
            fractureId={fracture.id}
            scenario={scenario}
          />
        ))
      )}
      {/* 回放扫描粒子层 */}
      {revealRatios && <PlaybackScanPoints fractures={fractures} revealRatios={revealRatios} />}
    </group>
  );
}

/**
 * 回放扫描粒子层 — 沿已揭示裂缝路径显示"已采集点云"
 * 揭示早期：少量散点；后期：点变密 → 管道成型
 */
function PlaybackScanPoints({ fractures, revealRatios }: { fractures: Fracture[]; revealRatios: Record<string, number> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // 为每条已揭示裂缝生成散点（确定性 — 不用 Math.random 避免闪烁）
  const { positions } = useMemo(() => {
    const positions: [number, number, number][] = [];

    // 确定性伪随机
    let seed = 12345;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    for (const f of fractures) {
      const ratio = revealRatios[f.id];
      if (!ratio || ratio <= 0) continue;

      const cutLen = Math.max(2, Math.ceil(f.path.length * ratio));
      // 点数随 ratio 增多（早期稀疏，后期密集）
      const dotCount = Math.ceil(cutLen * ratio * 4);

      for (let i = 0; i < dotCount; i++) {
        const t = rnd() * (cutLen / f.path.length);
        const pathIdx = Math.floor(t * (f.path.length - 1));
        const pathFrac = t * (f.path.length - 1) - pathIdx;
        const p1 = f.path[Math.min(pathIdx, f.path.length - 1)];
        const p2 = f.path[Math.min(pathIdx + 1, f.path.length - 1)];

        const spread = (f.porosity || 1) * 0.8;
        positions.push([
          p1[0] + (p2[0] - p1[0]) * pathFrac + (rnd() - 0.5) * spread,
          p1[1] + (p2[1] - p1[1]) * pathFrac + (rnd() - 0.5) * spread,
          p1[2] + (p2[2] - p1[2]) * pathFrac + (rnd() - 0.5) * spread,
        ]);
      }
    }
    return { positions };
  }, [fractures, revealRatios]);

  // 仅在 positions 变化时设置实例矩阵（不需要每帧更新）
  useEffect(() => {
    if (!meshRef.current || positions.length === 0) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < positions.length; i++) {
      dummy.position.set(...positions[i]);
      dummy.scale.setScalar(0.7 + ((i * 9301 + 49297) % 233280) / 233280 * 0.6);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  if (positions.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[0.12, 4, 4]} />
      <meshBasicMaterial color="#FFE600" transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
}

// ==================== 管道渲染 ====================

/** 计算管道颜色（基于传感器数据，使用标准状态色） */
function getPipeColor(fracture: Fracture, scenario: string): string {
  const sr = fracture.sensorReading;
  if (scenario === 'pipeline') {
    if (sr.ch4_pct > 20 || sr.h2s_ppm > 50) return STATUS.danger;
    if (sr.ch4_pct > 10 || sr.h2s_ppm > 20) return STATUS.warning;
    if (sr.permeability_md > 0.25) return STATUS.caution;
    return SCENARIO_BASE_COLOR.pipeline;
  }
  if (scenario === 'nuclear') {
    if (sr.ch4_pct > 25 || sr.h2s_ppm > 5) return STATUS.danger;
    if (sr.ch4_pct > 10 || sr.h2s_ppm > 2) return STATUS.warning;
    if (sr.permeability_md > 0.1) return STATUS.caution;
    return SCENARIO_BASE_COLOR.nuclear;
  }
  if (scenario === 'refinery') {
    if (sr.ch4_pct > 20 || sr.rock_strength_mpa > 5 || sr.acoustic_emission_mv > 2000) return STATUS.danger;
    if (sr.ch4_pct > 10 || sr.rock_strength_mpa > 3 || sr.acoustic_emission_mv > 1000) return STATUS.warning;
    if (sr.permeability_md > 0.3 || sr.humidity_pct < 70) return STATUS.caution;
    return SCENARIO_BASE_COLOR.refinery;
  }
  if (scenario === 'underground') {
    if (sr.permeability_md > 5000 || sr.temperature_c > 90) return STATUS.danger;
    if (sr.permeability_md > 2000 || sr.temperature_c > 70) return STATUS.warning;
    if (sr.permeability_md > 500 || sr.temperature_c > 50) return STATUS.safe;
    return SCENARIO_BASE_COLOR.underground;
  }
  return SCENARIO_BASE_COLOR.pipeline;
}

/** 3D 管道渲染 — TubeGeometry，管径基于 porosity（实际管径 m） */
function PipeMesh({
  fracture,
  isSelected,
  isHighlighted,
  scenario,
  revealRatio = 1,
}: {
  fracture: Fracture;
  isSelected: boolean;
  isHighlighted: boolean | null;
  scenario: ScenarioType;
  revealRatio?: number;
}) {
  const [hovered, setHovered] = useState(false);

  const { tubeGeo, hitGeo, joints } = useMemo(() => {
    const allPoints = fracture.path.map((p) => new THREE.Vector3(...p));
    if (allPoints.length < 2) {
      return {
        tubeGeo: null as THREE.TubeGeometry | null,
        hitGeo: null as THREE.TubeGeometry | null,
        joints: [] as { pos: THREE.Vector3; r: number }[],
      };
    }

    // 回放揭示：截断路径到已发现部分
    const cutCount = Math.max(2, Math.ceil(allPoints.length * revealRatio));
    const points = allPoints.slice(0, cutCount);

    const curve = new THREE.CatmullRomCurve3(points);
    // porosity 存储真实管径(m)。3D 演示层需要按场景压缩比例，避免大口径设备把内部测点/机器人完全遮挡。
    const diameter = fracture.porosity;
    const baseR =
      scenario === 'refinery'
        ? Math.min(0.42, Math.max(0.12, diameter * 0.18))
        : Math.max(0.2, diameter * 1.1);
    const radius = fracture.type === 'main' ? baseR : baseR * (scenario === 'refinery' ? 0.75 : 0.6);
    const segments = Math.max(16, Math.min(60, points.length * 2));
    const geo = new THREE.TubeGeometry(curve, segments, radius, 14, false);
    const hit = new THREE.TubeGeometry(curve, segments, Math.max(radius * 2.2, scenario === 'refinery' ? 0.35 : 0.7), 10, false);

    // 球形接头（管端连接点）— 替代法兰环，使管道看起来像有连接节点而非封堵
    const jointR = scenario === 'refinery' ? radius * 0.72 : radius * 1.3;
    const joints = [
      { pos: points[0], r: jointR },
      { pos: points[points.length - 1], r: jointR },
    ];
    return { tubeGeo: geo, hitGeo: hit, joints };
  }, [fracture, revealRatio, scenario]);

  if (!tubeGeo || !hitGeo) return null;

  const baseColor = getPipeColor(fracture, scenario);
  const inRegion = isHighlighted === true;
  const filtered = isHighlighted !== null;

  const opacity = filtered ? (inRegion ? 0.95 : 0.15) : (isSelected ? 0.95 : hovered ? 0.85 : scenario === 'refinery' ? 0.58 : 0.75);
  const emissive = isSelected ? INTERACTION.selected : hovered ? INTERACTION.hover : (filtered && inRegion) ? INTERACTION.selected : '#000000';
  const emissiveIntensity = isSelected ? 0.3 : hovered ? 0.15 : (filtered && inRegion) ? 0.25 : 0;
  const jointColor = isSelected || hovered ? INTERACTION.selected : scenario === 'refinery' ? '#D8B45A' : NUCLEAR_IDENTITY.sg;
  const jointOpacity = scenario === 'refinery' ? Math.min(0.72, opacity + 0.08) : opacity;

  return (
    <group
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* 管体 */}
      <mesh geometry={tubeGeo} userData={{ selectableKind: 'fracture', fractureId: fracture.id, nodeId: null }}>
        <meshStandardMaterial
          color={baseColor}
          transparent
          opacity={opacity}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.45}
          metalness={0.65}
          depthWrite={opacity > 0.5}
        />
      </mesh>
      <mesh geometry={hitGeo} userData={{ selectableKind: 'fracture', fractureId: fracture.id, nodeId: null }}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* 球形接头（管端连接节点） */}
      {joints.map((j, i) => (
        <mesh key={`joint-${i}`} position={j.pos} userData={{ selectableKind: 'fracture', fractureId: fracture.id, nodeId: null }}>
          <sphereGeometry args={[j.r, 12, 10]} />
          <meshStandardMaterial color={jointColor} roughness={0.5} metalness={scenario === 'refinery' ? 0.25 : 0.7} transparent opacity={jointOpacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** 管道入口标记 — 红色法兰+标签 */
function PipeEntrance({ position, name: _name }: { position: [number, number, number]; name: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={position} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[hovered ? 1.5 : 1.0, 0.15, 8, 20]} />
        <meshBasicMaterial color={ENTRANCE.pipe} transparent opacity={hovered ? 0.9 : 0.5} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color={ENTRANCE.pipe} />
      </mesh>
    </group>
  );
}

// ==================== 地下暗流通道渲染 ====================

/**
 * 地下暗流/油藏通道 — 水流/流体通道质感（非金属管道）
 *
 * 视觉特征：
 * - 半透明水流质感（非金属），蓝色/暗琥珀色
 * - 内部发光，模拟流体流动或传感器追踪
 * - 无球形接头（那看起来像管道法兰）
 * - 管径从 porosity 取值，但做额外缩放
 */
function UndergroundChannelMesh({
  fracture,
  isSelected,
  isHighlighted,
  revealRatio = 1,
}: {
  fracture: Fracture;
  isSelected: boolean;
  isHighlighted: boolean | null;
  revealRatio?: number;
}) {
  const [hovered, setHovered] = useState(false);

  const { tubeGeo, hitGeo } = useMemo(() => {
    const allPoints = fracture.path.map((p) => new THREE.Vector3(...p));
    if (allPoints.length < 2) return { tubeGeo: null as THREE.TubeGeometry | null, hitGeo: null as THREE.TubeGeometry | null };

    // 回放揭示：截断路径
    const cutCount = Math.max(2, Math.ceil(allPoints.length * revealRatio));
    const points = allPoints.slice(0, cutCount);

    const curve = new THREE.CatmullRomCurve3(points);
    // porosity 存储管径(m)，直接作为管半径
    const radius = Math.max(0.05, fracture.porosity * 0.9);
    const tubularSegments = Math.max(16, Math.min(60, points.length * 2));
    const radialSegments = 12;
    const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);

    // 顶点着色 — 沿路径渐变，基于传感器数据（渗透率）
    const nodeSensors = fracture.nodes.map((n) => getSensorMetric(n.sensors, 'underground'));
    const vertCount = (tubularSegments + 1) * (radialSegments + 1);
    const colors = new Float32Array(vertCount * 3);
    for (let i = 0; i <= tubularSegments; i++) {
      const t = i / tubularSegments;
      let value: number;
      if (nodeSensors.length === 0) {
        value = getSensorMetric(fracture.sensorReading, 'underground').value;
      } else {
        const idx = t * (nodeSensors.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.min(lo + 1, nodeSensors.length - 1);
        const frac = idx - lo;
        value = nodeSensors[lo].value * (1 - frac) + nodeSensors[hi].value * frac;
      }
      const metric = nodeSensors.length > 0 ? nodeSensors[0] : getSensorMetric(fracture.sensorReading, 'underground');
      const c = valueToColor(value, metric.min, metric.max, metric.threshold);
      for (let j = 0; j <= radialSegments; j++) {
        const vi = (i * (radialSegments + 1) + j) * 3;
        colors[vi] = c.r;
        colors[vi + 1] = c.g;
        colors[vi + 2] = c.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const hit = new THREE.TubeGeometry(curve, tubularSegments, Math.max(radius * 2.4, 0.8), 10, false);

    return { tubeGeo: geo, hitGeo: hit };
  }, [fracture, revealRatio]);

  if (!tubeGeo || !hitGeo) return null;

  const glowColor = GEO_IDENTITY.waterGlow;

  const inRegion = isHighlighted === true;
  const filtered = isHighlighted !== null;

  const opacity = filtered
    ? (inRegion ? 0.85 : 0.1)
    : (isSelected ? 0.85 : hovered ? 0.75 : 0.7);

  // 基础发光 — 始终自发光，确保远视角下通道可见（不被暗色岩体吞没）
  const emissive = isSelected
    ? INTERACTION.selected
    : hovered
    ? glowColor
    : filtered && inRegion
    ? INTERACTION.selected
    : filtered && !inRegion
    ? '#000000'
    : glowColor;
  const emissiveIntensity = isSelected
    ? 0.35
    : hovered
    ? 0.25
    : filtered && inRegion
    ? 0.3
    : filtered && !inRegion
    ? 0
    : 0.22;

  return (
    <group onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <mesh
        geometry={tubeGeo}
        renderOrder={2}
        userData={{ selectableKind: 'fracture', fractureId: fracture.id, nodeId: null }}
      >
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={opacity}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.2}
          metalness={0.0}
          depthWrite={opacity > 0.5}
        />
      </mesh>
      <mesh geometry={hitGeo} userData={{ selectableKind: 'fracture', fractureId: fracture.id, nodeId: null }}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** 地下暗流入口标记 — 水蓝色光圈 */
function UndergroundEntrance({
  position,
  name: _name,
}: {
  position: [number, number, number];
  name: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[hovered ? 1.2 : 0.8, 0.08, 8, 16]} />
        <meshBasicMaterial color={ENTRANCE.underground} transparent opacity={hovered ? 0.9 : 0.6} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color={ENTRANCE.underground} />
      </mesh>
    </group>
  );
}

/** 裂缝地表入口标记 — 黄色圆环 + 小球 */
function FractureEntrance({
  position,
  name: _name,
}: {
  position: [number, number, number];
  name: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[hovered ? 1.8 : 1.2, 0.12, 8, 16]} />
        <meshBasicMaterial color={ENTRANCE.fracture} transparent opacity={hovered ? 0.9 : 0.5} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshBasicMaterial color={ENTRANCE.fracture} />
      </mesh>
    </group>
  );
}

/**
 * 单条裂缝 — 扁平不规则裂面
 * 沿裂缝路径生成一个扁平的"隙缝"几何体：
 *   - 两条不平行的边界曲线定义裂面宽度
 *   - 上下盘各一个面，中间有缝隙
 *   - 带有 vertex colors 热力着色
 */
function FractureSurface({
  fracture,
  isSelected,
  isHighlighted,
  scenario,
  revealRatio = 1,
}: {
  fracture: Fracture;
  isSelected: boolean;
  isHighlighted: boolean | null;
  scenario: ScenarioType;
  revealRatio?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const colorMode = useSceneStore((s) => s.fractureColorMode);

  const { surfaceGeo, leftEdgeGeo, rightEdgeGeo, hitGeo } = useMemo(() => {
    const allPoints = fracture.path.map((p) => new THREE.Vector3(...p));
    if (allPoints.length < 2) return { surfaceGeo: null, leftEdgeGeo: null, rightEdgeGeo: null, hitGeo: null };

    // 回放揭示：截断路径
    const cutCount = Math.max(2, Math.ceil(allPoints.length * revealRatio));
    const points = allPoints.slice(0, cutCount);

    // 裂缝宽度：主裂缝宽，分支窄
    const width = fracture.type === 'main' ? 4.5 : 2.5;

    // 沿路径计算法线方向（用于展宽裂缝面）
    const curve = new THREE.CatmullRomCurve3(points);
    const segments = Math.max(12, fracture.path.length * 4);
    const framePoints = curve.getPoints(segments);

    // 计算每个点的局部坐标系（切线 + 法线）
    const upVec = new THREE.Vector3(0, 1, 0);
    const surfaceVerts: number[] = [];
    const leftEdgeVerts: number[] = [];
    const rightEdgeVerts: number[] = [];
    const surfaceColors: number[] = [];

    // 传感器数据插值
    const nodeSensors = fracture.nodes.map((n) => getSensorMetric(n.sensors, scenario));

    for (let i = 0; i < framePoints.length; i++) {
      const p = framePoints[i];
      const t = i / (framePoints.length - 1);

      // 切线
      let tangent: THREE.Vector3;
      if (i === 0) tangent = framePoints[1].clone().sub(framePoints[0]);
      else if (i === framePoints.length - 1) tangent = framePoints[i].clone().sub(framePoints[i - 1]);
      else tangent = framePoints[i + 1].clone().sub(framePoints[i - 1]);
      tangent.normalize();

      // 侧向（法线的近似）
      let side = new THREE.Vector3().crossVectors(tangent, upVec);
      if (side.lengthSq() < 0.001) side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(1, 0, 0));
      side.normalize();

      // 不规则宽度噪声
      const noiseW =
        Math.sin(p.x * 0.3 + p.z * 0.2) * 0.4 +
        Math.cos(p.y * 0.25 + p.x * 0.15) * 0.3;
      const halfW = width * (0.6 + noiseW * 0.4);

      // 不规则起伏（粗糙面）— 单面微偏移，不再产生双层
      const roughness =
        Math.sin(p.x * 0.8 + p.z * 0.5) * 0.3 +
        Math.cos(p.y * 0.6 + p.x * 0.4) * 0.2;

      // 单一裂缝面顶点（不再分上盘/下盘）
      const yOff = roughness * 0.3;
      const lx = p.x - side.x * halfW;
      const lz = p.z - side.z * halfW;
      const rx = p.x + side.x * halfW;
      const rz = p.z + side.z * halfW;

      surfaceVerts.push(lx, p.y + yOff, lz, rx, p.y - yOff, rz);
      leftEdgeVerts.push(lx, p.y + yOff, lz);
      rightEdgeVerts.push(rx, p.y - yOff, rz);

      // 颜色插值
      let value: number;
      if (nodeSensors.length === 0) {
        value = getSensorMetric(fracture.sensorReading, scenario).value;
      } else {
        const idx = t * (nodeSensors.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.min(lo + 1, nodeSensors.length - 1);
        const frac = idx - lo;
        value = nodeSensors[lo].value * (1 - frac) + nodeSensors[hi].value * frac;
      }
      // 颜色：根据着色模式决定
      const metric = nodeSensors.length > 0 ? nodeSensors[0] : getSensorMetric(fracture.sensorReading, scenario);
      const threshold = scenario === 'coal' ? gasThreshold : metric.threshold;
      let c: THREE.Color;
      if (colorMode === 'permeability') {
        // 渗透率着色 — 用裂缝自身渗透率
        c = permeabilityColor(fracture.sensorReading.permeability_md);
      } else if (colorMode === 'stress') {
        // 应力着色
        c = stressColor(fracture.sensorReading.stress_mpa);
      } else {
        // 默认：gas/传感器值着色
        c = valueToColor(value, metric.min, metric.max, threshold);
      }
      surfaceColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }

    // 构建 BufferGeometry
    const surfaceGeo = buildSurfaceGeo(surfaceVerts, surfaceColors, framePoints.length);

    // 双侧边缘线
    const leftEdgeGeo = new THREE.BufferGeometry();
    leftEdgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(leftEdgeVerts, 3));
    const rightEdgeGeo = new THREE.BufferGeometry();
    rightEdgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightEdgeVerts, 3));

    const hitCurve = new THREE.CatmullRomCurve3(framePoints);
    const hitGeo = new THREE.TubeGeometry(hitCurve, Math.max(16, framePoints.length * 2), 1.2, 8, false);

    return { surfaceGeo, leftEdgeGeo, rightEdgeGeo, hitGeo };
  }, [fracture, scenario, gasThreshold, colorMode, revealRatio]);

  if (!surfaceGeo || !hitGeo) return null;

  const emissiveColor = isSelected ? INTERACTION.selected : hovered ? INTERACTION.selected : '#000000';
  const emissiveIntensity = isSelected ? 0.4 : hovered ? 0.2 : 0;
  const edgeColor = isSelected ? INTERACTION.selected : hovered ? INTERACTION.hover : GEO_IDENTITY.vein;

  // 传感器区域筛选：在区域内 → 高亮加亮 + 发光；不在区域 → 变暗
  const inRegion = isHighlighted === true;
  const filtered = isHighlighted !== null;
  const baseOpacity = isSelected ? 0.85 : hovered ? 0.75 : 0.65;
  const finalOpacity = filtered
    ? (inRegion ? 0.95 : 0.12)  // 区域内高亮，区域外变暗
    : baseOpacity;
  const finalEmissive = filtered && inRegion ? INTERACTION.selected : emissiveColor;
  const finalEmissiveIntensity = filtered && inRegion ? 0.35 : emissiveIntensity;
  const finalEdgeColor = filtered && inRegion ? INTERACTION.selected : edgeColor;
  const finalEdgeOpacity = filtered ? (inRegion ? 0.9 : 0.1) : (isSelected ? 0.9 : 0.5);

  return (
    <group
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* 裂缝面 */}
      <mesh geometry={surfaceGeo} userData={{ selectableKind: 'fracture', fractureId: fracture.id, nodeId: null }}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          transparent
          opacity={finalOpacity}
          emissive={finalEmissive}
          emissiveIntensity={finalEmissiveIntensity}
          roughness={0.8}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={hitGeo} userData={{ selectableKind: 'fracture', fractureId: fracture.id, nodeId: null }}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 裂缝两侧轮廓线 */}
      <primitive object={new THREE.Line(leftEdgeGeo)}>
        <lineBasicMaterial color={finalEdgeColor} transparent opacity={finalEdgeOpacity} linewidth={1} />
      </primitive>
      <primitive object={new THREE.Line(rightEdgeGeo)}>
        <lineBasicMaterial color={finalEdgeColor} transparent opacity={finalEdgeOpacity} linewidth={1} />
      </primitive>
    </group>
  );
}

/**
 * 构建三角面片几何体（从三角带构建）
 */
function buildSurfaceGeo(
  verts: number[], colors: number[], pointCount: number
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  // 索引：三角带
  const indices: number[] = [];
  for (let i = 0; i < pointCount - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** 裂缝测点标记 — 只显示有机器人的节点 */
function FractureNodeMarker({
  node,
  fractureId: _fractureId,
  scenario,
}: {
  node: FractureNode;
  fractureId: string;
  scenario: ScenarioType;
}) {
  const [hovered, setHovered] = useState(false);

  const color = useMemo(() => {
    if (scenario === 'coal') {
      const ch4 = node.sensors.ch4_pct;
      if (ch4 > 3.0) return STATUS.danger;
      if (ch4 > 1.5) return STATUS.warning;
      if (ch4 > 1.0) return STATUS.caution;
    }
    if (scenario === 'gold') {
      if (node.sensors.microseismic_count > 15) return STATUS.danger;
      if (node.sensors.microseismic_count > 8) return STATUS.warning;
    }
    if (scenario === 'oil') {
      if (node.sensors.pore_pressure_mpa > 30) return STATUS.danger;
      if (node.sensors.pore_pressure_mpa > 20) return STATUS.warning;
    }
    if (scenario === 'pipeline') {
      if (node.sensors.ch4_pct > 20 || node.sensors.h2s_ppm > 50) return STATUS.danger;
      if (node.sensors.ch4_pct > 10 || node.sensors.h2s_ppm > 20) return STATUS.warning;
    }
    if (scenario === 'nuclear') {
      if (node.sensors.ch4_pct > 25 || node.sensors.water_pressure_mpa > 60) return STATUS.danger;
      if (node.sensors.ch4_pct > 10 || node.sensors.water_pressure_mpa > 40) return STATUS.warning;
    }
    if (scenario === 'refinery') {
      if (node.sensors.ch4_pct > 20 || node.sensors.rock_strength_mpa > 5 || node.sensors.acoustic_emission_mv > 2000) return STATUS.danger;
      if (node.sensors.ch4_pct > 10 || node.sensors.rock_strength_mpa > 3 || node.sensors.acoustic_emission_mv > 1000) return STATUS.warning;
    }
    if (scenario === 'underground') {
      if (node.sensors.permeability_md > 5000 || node.sensors.temperature_c > 90) return STATUS.danger;
      if (node.sensors.permeability_md > 2000 || node.sensors.temperature_c > 70) return STATUS.warning;
      return STATUS.safe;
    }
    return STATUS.safe;
  }, [node.sensors, scenario]);

  if (!node.robotId) return null;
  const isRefinery = scenario === 'refinery';
  const nodeSeq = Number(node.id.split('-N')[1] ?? 0);
  const isRefineryHighRisk =
    node.sensors.ch4_pct > 10 ||
    node.sensors.rock_strength_mpa > 3 ||
    node.sensors.acoustic_emission_mv > 1000;
  if (isRefinery && !isRefineryHighRisk && nodeSeq % 4 !== 0) return null;

  const isCoal = scenario === 'coal';
  if (isCoal) {
    const coalHighRisk = node.sensors.ch4_pct > 1.5 || node.sensors.co_ppm > 50;
    if (!coalHighRisk && nodeSeq % 5 !== 0) return null;
  }

  const visibleRadius = isRefinery
    ? (hovered ? 0.2 : 0.11)
    : isCoal
      ? (hovered ? 0.18 : 0.1)
      : (hovered ? 0.55 : 0.3);
  const hitRadius = isRefinery ? 0.45 : isCoal ? 0.36 : 0.8;
  const pickRadius = isRefinery ? 0.62 : isCoal ? 0.5 : 1.1;
  const opacity = isRefinery ? (isRefineryHighRisk ? 0.82 : 0.45) : isCoal ? 0.42 : 0.7;

  return (
    <group position={node.position} renderOrder={isRefinery ? 7 : 0}>
      <mesh
        userData={{ selectableKind: 'fracture', fractureId: node.id.split('-N')[0], nodeId: node.id }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[visibleRadius, 6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthTest={!isRefinery} depthWrite={false} />
      </mesh>
      <mesh userData={{ selectableKind: 'fracture', fractureId: node.id.split('-N')[0], nodeId: node.id }}>
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh userData={{ selectableKind: 'fracture', fractureId: node.id.split('-N')[0], nodeId: node.id }}>
        <sphereGeometry args={[pickRadius, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ==================== 煤矿专用：矿坑腔体 + 巷道 ====================

/** 煤矿 CH4 着色（复用 coal 的阈值逻辑） */
function getCoalCavityColor(sr: SensorReading): string {
  if (sr.ch4_pct > 3.0) return STATUS.danger;
  if (sr.ch4_pct > 1.5) return STATUS.warning;
  if (sr.ch4_pct > 1.0) return STATUS.caution;
  return '#8A6B42';
}

/**
 * 矿坑腔体 — 按路径轮廓生成的长条巷室/采空区剖面。
 * 真实采空区有底板、顶板、侧帮，不应表现成球壳。
 */
function CoalCavityMesh({
  fracture,
  isSelected,
  isHighlighted,
  revealRatio = 1,
}: {
  fracture: Fracture;
  isSelected: boolean;
  isHighlighted: boolean | null;
  revealRatio?: number;
}) {
  const [hovered, setHovered] = useState(false);

  const { pointGeo, floorGeo, shellGeo, borderGeo, hitGeo, center, rocks } = useMemo(() => {
    const rawPts = fracture.path.map((p) => new THREE.Vector3(...p));
    const visibleCount = Math.max(3, Math.ceil(rawPts.length * Math.max(0, Math.min(1, revealRatio))));
    const pts = rawPts.slice(0, visibleCount);
    const c = new THREE.Vector3();
    pts.forEach((p) => c.add(p));
    c.divideScalar(pts.length);

    const local = pts.map((p) => p.clone().sub(c));
    const xs = local.map((p) => p.x);
    const zs = local.map((p) => p.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const spanX = Math.max(2, maxX - minX);
    const spanZ = Math.max(2, maxZ - minZ);
    const clearance = Math.max(2.4, Math.min(5.8, (fracture.porosity || 5) * 0.55));
    const floorY = Math.min(...local.map((p) => p.y)) - 0.45;
    const roofY = floorY + clearance;
    const seed = fracture.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);

    const outline = local.slice(0, -1);
    const floorVertices: number[] = [];
    outline.forEach((p) => floorVertices.push(p.x, floorY - 0.18, p.z));
    const floor = new THREE.BufferGeometry();
    floor.setAttribute('position', new THREE.Float32BufferAttribute(floorVertices, 3));
    floor.setIndex(Array.from({ length: Math.max(0, outline.length - 2) }, (_, i) => [0, i + 1, i + 2]).flat());
    floor.computeVertexNormals();

    const shellVertices: number[] = [];
    outline.forEach((p, i) => {
      const roofLift = Math.sin(i * 1.7 + seed) * 0.22;
      shellVertices.push(p.x, floorY, p.z, p.x, roofY + roofLift, p.z);
    });
    const shellIndices: number[] = [];
    for (let i = 0; i < outline.length; i++) {
      const next = (i + 1) % outline.length;
      const floorA = i * 2;
      const roofA = floorA + 1;
      const floorB = next * 2;
      const roofB = floorB + 1;
      shellIndices.push(floorA, floorB, roofA, roofA, floorB, roofB);
    }
    for (let i = 1; i < outline.length - 1; i++) {
      shellIndices.push(1, i * 2 + 1, (i + 1) * 2 + 1);
    }
    const shell = new THREE.BufferGeometry();
    shell.setAttribute('position', new THREE.Float32BufferAttribute(shellVertices, 3));
    shell.setIndex(shellIndices);
    shell.computeVertexNormals();

    const pointVertices: number[] = [];
    const pointCount = Math.max(28, Math.min(76, Math.round((spanX + spanZ) * 1.8)));
    for (let i = 0; i < pointCount; i++) {
      const a = (Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1;
      const b = (Math.sin(seed * 4.1414 + i * 31.719) * 24634.6345) % 1;
      const u = Math.abs(a);
      const v = Math.abs(b);
      const x = minX + spanX * u;
      const z = minZ + spanZ * v;
      const floorBias = Math.pow(Math.abs(Math.sin(i * 0.73 + seed)), 2.2);
      const y = floorY + (roofY - floorY) * floorBias * 0.72;
      pointVertices.push(
        x + Math.sin(i * 1.7) * 0.22,
        y + Math.cos(i * 0.91) * 0.1,
        z + Math.cos(i * 1.13) * 0.22,
      );
    }
    const points = new THREE.BufferGeometry();
    points.setAttribute('position', new THREE.Float32BufferAttribute(pointVertices, 3));

    const borderVertices: number[] = [];
    local.forEach((p) => borderVertices.push(p.x, floorY + 0.04, p.z));
    if (local[0]) borderVertices.push(local[0].x, floorY + 0.04, local[0].z);
    const border = new THREE.BufferGeometry();
    border.setAttribute('position', new THREE.Float32BufferAttribute(borderVertices, 3));

    const rockInstances = Array.from({ length: Math.max(5, Math.min(11, Math.round((spanX + spanZ) * 0.22))) }, (_, i) => {
      const a = Math.abs((Math.sin(seed * 9.13 + i * 41.17) * 19317.19) % 1);
      const b = Math.abs((Math.sin(seed * 5.91 + i * 27.83) * 15731.73) % 1);
      const size = 0.45 + Math.abs(Math.sin(seed + i * 2.3)) * 0.95;
      return {
        position: [
          minX + spanX * a,
          floorY + size * 0.28,
          minZ + spanZ * b,
        ] as [number, number, number],
        scale: [
          size * (1.2 + Math.sin(i) * 0.22),
          size * (0.42 + Math.abs(Math.cos(i * 0.7)) * 0.28),
          size * (0.85 + Math.cos(i * 1.1) * 0.18),
        ] as [number, number, number],
        rotation: [0.2 + i * 0.31, i * 0.47, 0.1 + i * 0.19] as [number, number, number],
      };
    });

    const hit = new THREE.BoxGeometry(spanX + 2.5, clearance + 1.8, spanZ + 2.5);
    hit.translate((minX + maxX) / 2, (floorY + roofY) / 2, (minZ + maxZ) / 2);

    return { pointGeo: points, floorGeo: floor, shellGeo: shell, borderGeo: border, hitGeo: hit, center: c, rocks: rockInstances };
  }, [fracture, revealRatio]);

  const hazardColor = getCoalCavityColor(fracture.sensorReading);
  const inRegion = isHighlighted === true;
  const filtered = isHighlighted !== null;
  return (
    <group
      position={center}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh geometry={shellGeo} renderOrder={2}>
        <meshStandardMaterial
          color={fracture.sensorReading.ch4_pct > 1.5 ? '#6A3D2C' : '#6B543D'}
          transparent
          opacity={filtered ? (inRegion ? 0.5 : 0.1) : (isSelected || hovered ? 0.52 : 0.38)}
          side={THREE.DoubleSide}
          roughness={0.98}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={floorGeo} renderOrder={2}>
        <meshStandardMaterial
          color={fracture.sensorReading.ch4_pct > 1.5 ? '#5A3325' : '#4C3B2C'}
          transparent
          opacity={filtered ? (inRegion ? 0.5 : 0.08) : 0.42}
          side={THREE.DoubleSide}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
      <primitive object={new THREE.Line(borderGeo)} renderOrder={5}>
        <lineBasicMaterial
          color={hazardColor}
          transparent
          opacity={filtered ? (inRegion ? 0.7 : 0.14) : 0.46}
          depthWrite={false}
        />
      </primitive>
      {rocks.map((rock, index) => (
        <mesh
          key={`${fracture.id}-goaf-rock-${index}`}
          position={rock.position}
          rotation={rock.rotation}
          scale={rock.scale}
          renderOrder={3}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={fracture.sensorReading.ch4_pct > 1.5 ? '#3A2A24' : '#5A4A3A'}
            transparent
            opacity={filtered ? (inRegion ? 0.5 : 0.08) : 0.36}
            roughness={1}
            metalness={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      <points geometry={pointGeo} renderOrder={4}>
        <pointsMaterial
          color={filtered && inRegion ? hazardColor : '#A38967'}
          size={isSelected || hovered ? 0.14 : 0.085}
          sizeAttenuation
          transparent
          opacity={filtered ? (inRegion ? 0.52 : 0.1) : (isSelected || hovered ? 0.46 : 0.28)}
          depthWrite={false}
        />
      </points>
      {/* 透明命中体，方便点击选中 */}
      <mesh userData={{ selectableKind: 'fracture', fractureId: fracture.id }}>
        <primitive object={hitGeo} attach="geometry" />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * 煤矿巷道 — 约1m 宽 TubeGeometry，粗糙岩石材质。
 * 复用 PipeMesh 的几何范式，但非金属、无接头。
 */
function CoalTunnelMesh({
  fracture,
  isSelected,
  isHighlighted,
  revealRatio = 1,
}: {
  fracture: Fracture;
  isSelected: boolean;
  isHighlighted: boolean | null;
  revealRatio?: number;
}) {
  const [hovered, setHovered] = useState(false);

  const { tubeGeo, hitGeo } = useMemo(() => {
    const allPoints = fracture.path.map((p) => new THREE.Vector3(...p));
    if (allPoints.length < 2) return { tubeGeo: null, hitGeo: null };
    const cutCount = Math.max(2, Math.ceil(allPoints.length * revealRatio));
    const points = allPoints.slice(0, cutCount);
    const curve = new THREE.CatmullRomCurve3(points);
    // porosity 存通道宽度。巷道按窄长空间表现；注浆孔/顶板裂隙必须明显细于巷道。
    const isFracture = fracture.morphology === 'fracture';
    const r = isFracture
      ? Math.max(0.045, (fracture.porosity || 0.22) * 0.14)
      : Math.max(0.28, (fracture.porosity || 1) * 0.48);
    const segments = Math.max(12, Math.min(40, points.length * 2));
    const geo = new THREE.TubeGeometry(curve, segments, r, isFracture ? 5 : 8, false);
    const hit = new THREE.TubeGeometry(curve, segments, Math.max(r * 2.5, isFracture ? 0.28 : 0.45), 6, false);
    return { tubeGeo: geo, hitGeo: hit };
  }, [fracture, revealRatio]);

  if (!tubeGeo || !hitGeo) return null;

  const sensorColor = getCoalCavityColor(fracture.sensorReading);
  const inRegion = isHighlighted === true;
  const filtered = isHighlighted !== null;
  const isFracture = fracture.morphology === 'fracture';
  const baseColor = isFracture
    ? sensorColor
    : fracture.sensorReading.ch4_pct > 1.5
      ? '#C05A3F'
      : '#A57A4F';
  const opacity = filtered ? (inRegion ? 0.78 : 0.08) : (isSelected ? 0.78 : hovered ? 0.62 : isFracture ? 0.28 : 0.42);
  const emissive = isSelected ? INTERACTION.selected : hovered ? INTERACTION.hover : (filtered && inRegion) ? INTERACTION.selected : '#000000';

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 巷道体 */}
      <mesh
        geometry={tubeGeo}
        renderOrder={1}
        userData={{ selectableKind: 'fracture', fractureId: fracture.id }}
      >
        <meshStandardMaterial
          color={baseColor}
          transparent
          opacity={opacity}
          roughness={0.97}
          metalness={0.02}
          emissive={emissive}
          emissiveIntensity={isSelected ? 0.25 : hovered ? 0.12 : 0}
          depthWrite={false}
        />
      </mesh>
      {/* 透明命中体 */}
      <mesh geometry={hitGeo} userData={{ selectableKind: 'fracture', fractureId: fracture.id }}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
