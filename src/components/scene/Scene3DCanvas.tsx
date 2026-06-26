import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { RobotMarkers } from './RobotMarkers';
import { MonitorMarkers } from './MonitorMarkers';
import { CameraInfo, CameraTracker } from './CameraInfo';
import { HighlightRegion } from './HighlightRegion';
import { VolumeMeasure } from './VolumeMeasure';
import { ProfileLineTool } from './ProfileLineTool';
import { DistanceMeasureTool } from './DistanceMeasureTool';
import { TextAnnotationTool } from './TextAnnotationTool';
import { AnnotationOverlay } from './AnnotationOverlay';
import { POIMarkers } from './POIMarkers';
import { AIMarkers3D, AIMarkerScreenOverlay } from './AIMarkers3D';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { RockMass } from './RockMass';
import { ReactorContainment } from './ReactorContainment';
import { RefineryVessels } from './RefineryVessels';
import { ScenarioStructureLayer, COAL_STRUCTURE_DEFINITIONS } from './ScenarioStructureLayer';
import { FractureNetwork } from './FractureNetwork';
import { PotreeViewer, PotreeCameraSync } from './PotreeViewer';
import { DeckGlHeatmap } from './DeckGlHeatmap';
import { PlaybackEngine, PlaybackBar } from './PlaybackController';
import { useCanvasInteraction } from './useCanvasInteraction';
import { useAllRobots } from '../../hooks/useRobots';
import { generateMockMonitors } from '../../data/robotDataGenerator';
import { snapMeasurementPoint } from '../../lib/measurementPicking';
import type { Robot, Monitor } from '../../types';

interface OrbitControlsLike {
  target: THREE.Vector3;
  enabled: boolean;
  update: () => void;
}

type PickCandidateKind = 'robot' | 'monitor' | 'coalStructure' | 'node' | 'path';

interface PickCandidate {
  kind: PickCandidateKind;
  id: string;
  label: string;
  subtitle: string;
  distanceSq: number;
  point: [number, number, number];
  robotId?: string;
  monitorId?: string;
  coalStructureId?: string;
  fractureId?: string;
  nodeId?: string | null;
}

interface PickCandidateEventDetail {
  x: number;
  y: number;
  candidates: PickCandidate[];
}

const PICK_CANDIDATE_EVENT = 'hive:pick-candidates';

function asOrbitControls(value: unknown): OrbitControlsLike | null {
  if (
    value &&
    typeof value === 'object' &&
    'target' in value &&
    'enabled' in value &&
    'update' in value
  ) {
    return value as OrbitControlsLike;
  }
  return null;
}

function DevProjectionBridge() {
  const { camera, gl } = useThree();
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const fractures = useSceneStore((s) => s.fractures);
  const { data: robots } = useAllRobots(dataSource, scenario);
  const monitors = generateMockMonitors(dataSource, scenario);
  const lastSerialized = useRef('');

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const win = window as Window & {
      __HIVE_DEV_VIEW__?: {
        projectPoint: (point: [number, number, number]) => { x: number; y: number; visible: boolean };
      };
    };

    win.__HIVE_DEV_VIEW__ = {
      projectPoint: (point) => projectWorldToScreen(point, camera, gl.domElement),
    };

    return () => {
      delete win.__HIVE_DEV_VIEW__;
    };
  }, [camera, gl]);

  useFrame(() => {
    if (!import.meta.env.DEV) return;
    const beacon = document.querySelector('[data-testid="dev-interactions"]');
    if (!(beacon instanceof HTMLElement)) return;

    const rect = gl.domElement.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const distSq = (point: { x: number; y: number }) => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return dx * dx + dy * dy;
    };

    const visibleRobots = (robots ?? [])
      .map((robot) => ({
        id: robot.id,
        label: robot.task,
        point: robot.position,
        screen: projectWorldToScreen(robot.position, camera, gl.domElement),
      }))
      .filter((target) => target.screen.visible)
      .sort((a, b) => distSq(a.screen) - distSq(b.screen));

    const visibleMonitors = monitors
      .map((monitor) => ({
        id: monitor.id,
        label: monitor.id,
        type: 'monitor' as const,
        point: monitor.position,
        screen: projectWorldToScreen(monitor.position, camera, gl.domElement),
      }))
      .filter((target) => target.screen.visible)
      .sort((a, b) => distSq(a.screen) - distSq(b.screen));

    const visibleFractureNodes = fractures
      .flatMap((fracture) => fracture.nodes
        .filter((node) => node.robotId)
        .map((node) => ({
          id: node.id,
          label: fracture.name,
          point: node.position,
          screen: projectWorldToScreen(node.position, camera, gl.domElement),
      })))
      .filter((target) => target.screen.visible)
      .sort((a, b) => distSq(a.screen) - distSq(b.screen));

    const visibleFracturePaths = fractures
      .flatMap((fracture) => fracture.path
        .filter((_, index) => index % 2 === 0)
        .map((point, index) => ({
          id: `${fracture.id}-path-${index}`,
          label: fracture.name,
          point,
          screen: projectWorldToScreen(point, camera, gl.domElement),
      })))
      .filter((target) => target.screen.visible)
      .sort((a, b) => distSq(a.screen) - distSq(b.screen));

    const payload = JSON.stringify({
      robots: visibleRobots,
      monitors: visibleMonitors,
      fractureNodes: visibleFractureNodes,
      fracturePaths: visibleFracturePaths,
    });

    if (payload === lastSerialized.current) return;
    lastSerialized.current = payload;

    beacon.dataset.robots = JSON.stringify(visibleRobots);
    beacon.dataset.monitors = JSON.stringify(visibleMonitors);
    beacon.dataset.fractureNodes = JSON.stringify(visibleFractureNodes);
    beacon.dataset.fracturePaths = JSON.stringify(visibleFracturePaths);
  });

  return null;
}

export function Scene3DCanvas() {
  const layers = useSceneStore((s) => s.layers);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const setCaptureScreenshot = useSceneStore((s) => s.setCaptureScreenshot);
  const activeTool = useSceneStore((s) => s.activeTool);
  const highlightActive = useSceneStore((s) => s.highlightRegion.active);
  const aiMarkerCount = useSceneStore((s) => s.aiMarkers.length);
  const clearHighlight = useSceneStore((s) => s.clearHighlight);
  const clearAIMarkers = useSceneStore((s) => s.clearAIMarkers);
  const resetSceneView = useSceneStore((s) => s.resetSceneView);
  const locale = useSceneStore((s) => s.locale);
  const isCoalScene = dataSource === 'fracture' && scenario === 'coal';
  const initialCameraPosition: [number, number, number] = isCoalScene ? [10, -25, 74] : [30, 42, 50];
  const initialControlTarget: [number, number, number] = isCoalScene ? [6, -35, 10] : [0, 0, 0];

  return (
    <div className="relative w-full h-full grid-bg overflow-hidden">
      <SceneErrorBoundary>
        <Canvas
          camera={{ position: initialCameraPosition, fov: isCoalScene ? 46 : 50, near: 0.1, far: 3000 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          dpr={[1, 1.5]}
          onCreated={({ gl }) => {
            gl.setClearColor('#080812');
            setCaptureScreenshot(() => {
              try {
                return gl.domElement.toDataURL('image/png');
              } catch (e) {
                console.error('Screenshot failed', e);
                return null;
              }
            });
          }}
        >
          {/* Lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[50, 50, 50]} intensity={0.8} />
          <pointLight position={[-30, -10, 0]} intensity={0.5} color="#1E3A5F" />
          <pointLight position={[0, 20, 0]} intensity={0.4} color="#FFE600" />

          {/* Reference grid for spatial awareness */}
          <gridHelper args={[200, 40, '#1A1D2A', '#0A0C14']} position={[0, -22, 0]} />

          {/* 岩体 + 裂缝网络 — 核心场景 */}
          <RockMass />
          <ReactorContainment />
          <RefineryVessels />
          <ScenarioStructureLayer />
          <FractureNetwork />
          {/* R3F 原生热力图（瓦斯/温度）— 跟随场景旋转/平移 */}
          <DeckGlHeatmap />

          {/* Potree 相机同步（R3F → Potree，每帧更新） */}
          {layers.pointCloud && <PotreeCameraSync />}

          {layers.robots && <RobotMarkers />}
          <MonitorMarkers />
          {/* 旧 POI 数据只适合金矿/油气裂缝入口；煤矿新版使用原始巷道/机器人/测点数据表达异常。 */}
          {layers.poi && dataSource === 'fracture' && scenario !== 'coal' && <POIMarkers />}
          <AIMarkers3D />
          <HighlightRegion />
          <VolumeMeasure />
          <ProfileLineTool />
          <DistanceMeasureTool />
          <TextAnnotationTool />
          <AnnotationOverlay />

          <CameraFlyToHandler />
          <PlaybackEngine />
          <SceneSelectionController />
          <CameraTracker />
          <DevProjectionBridge />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.6}
            panSpeed={0.6}
            zoomSpeed={0.8}
            target={initialControlTarget}
            minDistance={5}
            maxDistance={300}
            mouseButtons={{
              LEFT: activeTool === 'none' ? THREE.MOUSE.ROTATE : undefined,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: activeTool === 'none' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
            }}
          />
        </Canvas>
      </SceneErrorBoundary>

      {/* HTML overlays outside Canvas */}
      <CameraInfo />

      {/* Potree 工业级点云渲染（独立 WebGL context，八叉树 LOD） */}
      <PotreeViewer />

      <OverlapPickMenu />

      <AIMarkerScreenOverlay />

      {/* 任务回放控制条 */}
      <PlaybackBar />

      {/* 右下角坐标信息（替代原来的开发者标签） */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
        <span className="text-[9px] px-1.5 py-0.5 bg-[#1A1D2A]/80 text-[#3FB950]/70 rounded border border-white/5 font-mono">
          ● LIVE
        </span>
      </div>

      {/* 浮动场景控制工具栏 — 右上角 */}
      <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5">
        <button
          onClick={() => resetSceneView()}
          title={locale === 'zh-CN' ? '重置视角 · 清除所有标记和高亮' : 'Reset camera and clear markers'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-[#1A1D2A]/85 backdrop-blur-md text-[#E0E0E8] hover:text-[#FFE600] rounded-lg border border-white/10 hover:border-[#FFE600]/30 transition-all shadow-lg"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12l9-9 9 9M5 10v10h14V10" />
          </svg>
          {locale === 'zh-CN' ? '全景' : 'Overview'}
        </button>

        {highlightActive && (
          <button
            onClick={() => clearHighlight()}
            title={locale === 'zh-CN' ? '关闭高亮球体' : 'Clear highlight'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-[#1A1D2A]/85 backdrop-blur-md text-[#FFE600] hover:text-[#FFF] rounded-lg border border-[#FFE600]/30 hover:border-[#FFE600]/50 transition-all shadow-lg animate-fade-in"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 9l6 6M15 9l-6 6" />
            </svg>
            {locale === 'zh-CN' ? '取消高亮' : 'Clear Highlight'}
          </button>
        )}

        {aiMarkerCount > 0 && (
          <button
            onClick={() => clearAIMarkers()}
            title={locale === 'zh-CN' ? '清除AI分析标记' : 'Clear AI markers'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-[#1A1D2A]/85 backdrop-blur-md text-[#FF6666] hover:text-[#FF9999] rounded-lg border border-[#FF3333]/30 hover:border-[#FF3333]/50 transition-all shadow-lg animate-fade-in"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v6m0 0l-3-3m3 3l3-3M5 14v6h14v-6M3 14h18" />
            </svg>
            {locale === 'zh-CN' ? `清除标记 (${aiMarkerCount})` : `Clear Markers (${aiMarkerCount})`}
          </button>
        )}
      </div>
    </div>
  );
}

function squaredDistance3D(a: [number, number, number], b: [number, number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

function projectWorldToScreen(
  point: [number, number, number],
  camera: THREE.Camera,
  dom: HTMLCanvasElement,
): { x: number; y: number; visible: boolean } {
  const rect = dom.getBoundingClientRect();
  const vector = new THREE.Vector3(point[0], point[1], point[2]).project(camera);
  const x = ((vector.x + 1) / 2) * rect.width + rect.left;
  const y = ((-vector.y + 1) / 2) * rect.height + rect.top;
  const visible =
    vector.z >= -1 &&
    vector.z <= 1 &&
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom;
  return {
    x,
    y,
    visible,
  };
}

function squaredDistance2D(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function squaredDistanceToSegment2D(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  const t = abLenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq)) : 0;
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return dx * dx + dy * dy;
}

function findNearestPointOnStructure(
  click: { x: number; y: number },
  structure: (typeof COAL_STRUCTURE_DEFINITIONS)[number],
  camera: THREE.Camera,
  dom: HTMLCanvasElement,
): [number, number, number] {
  let bestPoint = structure.points[0];
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (let i = 0; i < structure.points.length; i += 1) {
    const point = structure.points[i];
    const projected = projectWorldToScreen(point, camera, dom);
    if (!projected.visible) continue;
    const distSq = squaredDistance2D(click, projected);
    if (distSq < bestDistanceSq) {
      bestDistanceSq = distSq;
      bestPoint = point;
    }
    if (i > 0) {
      const prev = structure.points[i - 1];
      const prevProjected = projectWorldToScreen(prev, camera, dom);
      if (!prevProjected.visible) continue;
      const segDistSq = squaredDistanceToSegment2D(click, prevProjected, projected);
      if (segDistSq < bestDistanceSq) {
        bestDistanceSq = segDistSq;
        bestPoint = segDistSq < distSq ? prev : point;
      }
    }
  }
  return bestPoint;
}

function findNearestRobot(
  point: [number, number, number],
  robots: Robot[],
  maxDistance = 3.5
): Robot | null {
  const maxDistanceSq = maxDistance * maxDistance;
  let best: Robot | null = null;
  let bestSq = maxDistanceSq;

  for (const robot of robots) {
    const distSq = squaredDistance3D(point, robot.position);
    if (distSq <= bestSq) {
      bestSq = distSq;
      best = robot;
    }
  }

  return best;
}

function findNearestRobotByScreen(
  screen: { x: number; y: number },
  robots: Robot[],
  camera: THREE.Camera,
  dom: HTMLCanvasElement,
  maxDistancePx = 90,
): { robot: Robot; distanceSq: number } | null {
  const maxDistanceSq = maxDistancePx * maxDistancePx;
  let best: Robot | null = null;
  let bestSq = maxDistanceSq;

  for (const robot of robots) {
    const projected = projectWorldToScreen(robot.position, camera, dom);
    if (!projected.visible) continue;
    const distSq = squaredDistance2D(screen, projected);
    if (distSq <= bestSq) {
      bestSq = distSq;
      best = robot;
    }
  }

  return best ? { robot: best, distanceSq: bestSq } : null;
}

function findNearestFractureSelectionByScreen(
  screen: { x: number; y: number },
  fractures: ReturnType<typeof useSceneStore.getState>['fractures'],
  camera: THREE.Camera,
  dom: HTMLCanvasElement,
  maxDistancePx = 70,
): { fractureId: string; nodeId: string | null; point: [number, number, number]; distanceSq: number } | null {
  const nodeMaxDistanceSq = Math.max(maxDistancePx, 92) ** 2;
  const pathMaxDistanceSq = maxDistancePx * maxDistancePx;
  let bestNode: { fractureId: string; nodeId: string; point: [number, number, number]; distanceSq: number } | null = null;
  let bestNodeSq = nodeMaxDistanceSq;
  let bestPath: { fractureId: string; nodeId: null; point: [number, number, number]; distanceSq: number } | null = null;
  let bestPathSq = pathMaxDistanceSq;

  for (const monitor of monitors) {
    const projected = projectWorldToScreen(monitor.position, camera, dom);
    if (!projected.visible) continue;
    const distanceSq = squaredDistance2D(screen, projected);
    if (distanceSq > maxDistanceSq) continue;
    candidates.push({
      kind: 'monitor',
      id: `monitor:${monitor.id}`,
      label: monitor.id,
      subtitle: monitor.task,
      distanceSq,
      point: monitor.position,
      monitorId: monitor.id,
    });
  }

  for (const structure of COAL_STRUCTURE_DEFINITIONS) {
    let bestStructurePoint: [number, number, number] | null = null;
    let bestStructureDistanceSq = maxDistanceSq;
    for (let i = 0; i < structure.points.length; i += 1) {
      const point = structure.points[i];
      const projected = projectWorldToScreen(point, camera, dom);
      if (!projected.visible) continue;
      if (i === 0) {
        const distanceSq = squaredDistance2D(screen, projected);
        if (distanceSq <= bestStructureDistanceSq) {
          bestStructureDistanceSq = distanceSq;
          bestStructurePoint = point;
        }
        continue;
      }
      const prev = structure.points[i - 1];
      const prevProjected = projectWorldToScreen(prev, camera, dom);
      if (!prevProjected.visible) continue;
      const distanceSq = squaredDistanceToSegment2D(screen, prevProjected, projected);
      if (distanceSq <= bestStructureDistanceSq) {
        bestStructureDistanceSq = distanceSq;
        bestStructurePoint = point;
      }
    }
    if (!bestStructurePoint) continue;
    candidates.push({
      kind: 'coalStructure',
      id: structure.id,
      label: structure.id,
      subtitle: structure.name,
      distanceSq: bestStructureDistanceSq,
      point: bestStructurePoint,
      coalStructureId: structure.id,
    });
  }

  for (const fracture of fractures) {
    for (const node of fracture.nodes) {
      if (!node.robotId) continue;
      const projected = projectWorldToScreen(node.position, camera, dom);
      if (!projected.visible) continue;
      const distSq = squaredDistance2D(screen, projected);
      if (distSq <= bestNodeSq) {
        bestNodeSq = distSq;
        bestNode = { fractureId: fracture.id, nodeId: node.id, point: node.position, distanceSq: distSq };
      }
    }

    for (let i = 0; i < fracture.path.length; i += 2) {
      const point = fracture.path[i];
      const projected = projectWorldToScreen(point, camera, dom);
      if (!projected.visible) continue;
      const distSq = squaredDistance2D(screen, projected);
      if (distSq <= bestPathSq) {
        bestPathSq = distSq;
        bestPath = { fractureId: fracture.id, nodeId: null, point, distanceSq: distSq };
      }
    }
  }

  const nodePreferenceSq = 42 ** 2;
  if (bestNode && (!bestPath || bestNode.distanceSq <= bestPath.distanceSq + nodePreferenceSq)) {
    return bestNode;
  }

  return bestPath;
}

function collectPickCandidates(
  screen: { x: number; y: number },
  robots: Robot[],
  monitors: Monitor[],
  fractures: ReturnType<typeof useSceneStore.getState>['fractures'],
  camera: THREE.Camera,
  dom: HTMLCanvasElement,
  radiusPx = 46,
): PickCandidate[] {
  const maxDistanceSq = radiusPx * radiusPx;
  const candidates: PickCandidate[] = [];

  for (const robot of robots) {
    const projected = projectWorldToScreen(robot.position, camera, dom);
    if (!projected.visible) continue;
    const distanceSq = squaredDistance2D(screen, projected);
    if (distanceSq > maxDistanceSq) continue;
    candidates.push({
      kind: 'robot',
      id: `robot:${robot.id}`,
      label: robot.id,
      subtitle: robot.task,
      distanceSq,
      point: robot.position,
      robotId: robot.id,
    });
  }

  for (const monitor of monitors) {
    const projected = projectWorldToScreen(monitor.position, camera, dom);
    if (!projected.visible) continue;
    const distanceSq = squaredDistance2D(screen, projected);
    if (distanceSq > maxDistanceSq) continue;
    candidates.push({
      kind: 'monitor',
      id: `monitor:${monitor.id}`,
      label: monitor.id,
      subtitle: monitor.task,
      distanceSq,
      point: monitor.position,
      monitorId: monitor.id,
    });
  }

  for (const fracture of fractures) {
    for (const node of fracture.nodes) {
      if (!node.robotId) continue;
      const projected = projectWorldToScreen(node.position, camera, dom);
      if (!projected.visible) continue;
      const distanceSq = squaredDistance2D(screen, projected);
      if (distanceSq > maxDistanceSq) continue;
      candidates.push({
        kind: 'node',
        id: `node:${node.id}`,
        label: node.id,
        subtitle: fracture.name,
        distanceSq,
        point: node.position,
        fractureId: fracture.id,
        nodeId: node.id,
      });
    }

    for (let i = 0; i < fracture.path.length; i += 2) {
      const point = fracture.path[i];
      const projected = projectWorldToScreen(point, camera, dom);
      if (!projected.visible) continue;
      const distanceSq = squaredDistance2D(screen, projected);
      if (distanceSq > maxDistanceSq) continue;
      candidates.push({
        kind: 'path',
        id: `path:${fracture.id}:${i}`,
        label: fracture.id,
        subtitle: fracture.name,
        distanceSq,
        point,
        fractureId: fracture.id,
        nodeId: null,
      });
    }
  }

  const deduped = new Map<string, PickCandidate>();
  for (const candidate of candidates.sort((a, b) => a.distanceSq - b.distanceSq)) {
    if (!deduped.has(candidate.id)) deduped.set(candidate.id, candidate);
  }

  return [...deduped.values()].slice(0, 6);
}

function dispatchPickCandidates(x: number, y: number, candidates: PickCandidate[]) {
  window.dispatchEvent(new CustomEvent<PickCandidateEventDetail>(PICK_CANDIDATE_EVENT, {
    detail: { x, y, candidates },
  }));
}

function clearPickCandidates() {
  window.dispatchEvent(new CustomEvent<PickCandidateEventDetail>(PICK_CANDIDATE_EVENT, {
    detail: { x: 0, y: 0, candidates: [] },
  }));
}

function candidateKindLabel(kind: PickCandidateKind, locale: 'zh-CN' | 'en-US') {
  if (kind === 'robot') return locale === 'zh-CN' ? '机器人' : 'Robot';
  if (kind === 'monitor') return locale === 'zh-CN' ? '监视器' : 'Monitor';
  if (kind === 'coalStructure') return locale === 'zh-CN' ? '结构' : 'Structure';
  if (kind === 'node') return locale === 'zh-CN' ? '测点' : 'Node';
  return locale === 'zh-CN' ? '通道' : 'Path';
}

function OverlapPickMenu() {
  const locale = useSceneStore((s) => s.locale);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const fractures = useSceneStore((s) => s.fractures);
  const flyTo = useSceneStore((s) => s.flyTo);
  const openRobotDetail = useSceneStore((s) => s.openRobotDetail);
  const openMonitorDetail = useSceneStore((s) => s.openMonitorDetail);
  const selectFracture = useSceneStore((s) => s.selectFracture);
  const selectFractureNode = useSceneStore((s) => s.selectFractureNode);
  const selectCoalStructure = useSceneStore((s) => s.selectCoalStructure);
  const highlightWithTimer = useSceneStore((s) => s.highlightWithTimer);
  const closeRobotDetail = useSceneStore((s) => s.closeRobotDetail);
  const { data: robots } = useAllRobots(dataSource, scenario);
  const monitors = generateMockMonitors(dataSource, scenario);
  const [menu, setMenu] = useState<{ x: number; y: number; candidates: PickCandidate[] } | null>(null);

  useEffect(() => {
    const onCandidates = (event: Event) => {
      const detail = (event as CustomEvent<PickCandidateEventDetail>).detail;
      if (!detail?.candidates?.length) {
        setMenu(null);
        return;
      }
      setMenu({
        x: Math.min(window.innerWidth - 260, Math.max(12, detail.x + 10)),
        y: Math.min(window.innerHeight - 220, Math.max(52, detail.y + 10)),
        candidates: detail.candidates,
      });
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener(PICK_CANDIDATE_EVENT, onCandidates);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener(PICK_CANDIDATE_EVENT, onCandidates);
      window.removeEventListener('keydown', onEscape);
    };
  }, []);

  if (!menu) return null;

  const chooseCandidate = (candidate: PickCandidate) => {
    if (candidate.kind === 'robot' && candidate.robotId) {
      const robot = robots?.find((item) => item.id === candidate.robotId);
      if (robot) {
        flyTo({ position: robot.position, region: `robot-${robot.id}`, zoom: 'close' });
        openRobotDetail(robot);
      }
    } else if (candidate.kind === 'monitor' && candidate.monitorId) {
      const monitor = monitors.find((item) => item.id === candidate.monitorId);
      if (monitor) {
        flyTo({ position: monitor.position, region: `monitor-${monitor.id}`, zoom: 'close' });
        openMonitorDetail(monitor);
      }
    } else if (candidate.kind === 'coalStructure' && candidate.coalStructureId) {
      const structure = COAL_STRUCTURE_DEFINITIONS.find((item) => item.id === candidate.coalStructureId);
      if (structure) {
        selectCoalStructure({
          id: structure.id,
          name: structure.name,
          kind: structure.kind,
          position: candidate.point,
          points: structure.points,
        });
        flyTo({ position: candidate.point, region: structure.id, zoom: 'close' });
      }
    } else if (candidate.fractureId) {
      const fracture = fractures.find((item) => item.id === candidate.fractureId);
      if (fracture) {
        selectFracture(fracture);
        selectFractureNode(candidate.nodeId ?? null);
        closeRobotDetail();
        flyTo({ position: candidate.point, region: candidate.nodeId ?? fracture.id, zoom: 'close' });
        setTimeout(() => highlightWithTimer(candidate.point, candidate.nodeId ? 1.6 : 2.4, 3500), 1200);
      }
    }
    setMenu(null);
  };

  return (
    <div
      data-testid="overlap-pick-menu"
      className="absolute z-40 w-[240px] rounded-lg border border-[#D9E1EA] bg-white shadow-xl"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="flex items-center justify-between border-b border-[#E5EAF1] px-2.5 py-2">
        <div className="text-[11px] font-semibold text-[#182230]">
          {locale === 'zh-CN' ? '选择重叠对象' : 'Select Object'}
        </div>
        <button
          data-testid="overlap-pick-close"
          className="rounded px-1.5 py-0.5 text-[11px] text-[#667085] hover:bg-[#F2F4F7]"
          onClick={() => setMenu(null)}
        >
          ESC
        </button>
      </div>
      <div className="max-h-[176px] overflow-auto p-1.5">
        {menu.candidates.map((candidate, index) => (
          <button
            key={candidate.id}
            data-testid={`overlap-pick-option-${index}`}
            data-pick-kind={candidate.kind}
            data-pick-id={candidate.id}
            className="mb-1 w-full rounded-md border border-transparent px-2 py-1.5 text-left hover:border-[#C99A2E]/30 hover:bg-[#FFFAF0]"
            onClick={() => chooseCandidate(candidate)}
          >
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-[#F2F4F7] px-1.5 py-0.5 text-[9px] font-semibold text-[#667085]">
                {candidateKindLabel(candidate.kind, locale)}
              </span>
              <span className="truncate text-[11px] font-mono font-semibold text-[#182230]">{candidate.label}</span>
            </div>
            <div className="mt-0.5 truncate text-[9px] text-[#667085]">{candidate.subtitle}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SceneSelectionController() {
  const { camera, gl } = useThree();
  const activeTool = useSceneStore((s) => s.activeTool);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const fractures = useSceneStore((s) => s.fractures);
  const flyTo = useSceneStore((s) => s.flyTo);
  const openRobotDetail = useSceneStore((s) => s.openRobotDetail);
  const selectFracture = useSceneStore((s) => s.selectFracture);
  const selectFractureNode = useSceneStore((s) => s.selectFractureNode);
  const highlightWithTimer = useSceneStore((s) => s.highlightWithTimer);
  const closeRobotDetail = useSceneStore((s) => s.closeRobotDetail);
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const clearHighlight = useSceneStore((s) => s.clearHighlight);
  const { data: robots } = useAllRobots(dataSource, scenario);
  const monitors = generateMockMonitors(dataSource, scenario);
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const writeDebug = (patch: Record<string, string>) => {
    if (!import.meta.env.DEV) return;
    const beacon = document.querySelector('[data-testid="dev-selection-debug"]');
    if (!(beacon instanceof HTMLElement)) return;
    Object.entries(patch).forEach(([key, value]) => {
      beacon.dataset[key] = value;
    });
  };

  useCanvasInteraction(activeTool === 'none', {
    onPointerDown: (_point, e) => {
      downRef.current = { x: e.clientX, y: e.clientY };
      writeDebug({
        lastDown: JSON.stringify({ x: e.clientX, y: e.clientY }),
        lastSelection: 'pointer-down',
      });
    },
    onPointerUpDetail: (detail, e) => {
      const down = downRef.current;
      downRef.current = null;
      if (!down) return;

      const delta = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      writeDebug({
        lastUp: JSON.stringify({ x: e.clientX, y: e.clientY }),
        lastDelta: delta.toFixed(2),
      });
      if (delta > 6) return;

      const screenPoint = { x: e.clientX, y: e.clientY };
      const directHit = detail.hit;
      if (directHit?.kind === 'coalStructure') {
        const structure = COAL_STRUCTURE_DEFINITIONS.find((item) => item.id === directHit.structureId);
        if (structure) {
          const nearestPoint = findNearestPointOnStructure(screenPoint, structure, camera, gl.domElement);
          const relatedMonitors = monitors.filter((monitor) => monitor.relatedCoalStructureId === structure.id);
          const monitorCandidates = relatedMonitors.map((monitor) => ({
            kind: 'monitor' as const,
            id: `monitor:${monitor.id}`,
            label: monitor.id,
            subtitle: monitor.task,
            distanceSq: 0,
            point: monitor.position,
            monitorId: monitor.id,
          }));
          dispatchPickCandidates(e.clientX, e.clientY, [{
            kind: 'coalStructure',
            id: structure.id,
            label: structure.id,
            subtitle: structure.name,
            distanceSq: 0,
            point: nearestPoint,
            coalStructureId: structure.id,
          }, ...monitorCandidates]);
          writeDebug({ lastSelection: `direct-structure-menu:${structure.id}` });
          return;
        }
      }

      const pickCandidates = collectPickCandidates(
        screenPoint,
        robots ?? [],
        monitors,
        fractures,
        camera,
        gl.domElement,
      );
      const hasCoalStructureCandidate = pickCandidates.some((candidate) => candidate.kind === 'coalStructure');
      const hasRobotCandidate = pickCandidates.some((candidate) => candidate.kind === 'robot');
      const hasSpatialCandidate = pickCandidates.some((candidate) => candidate.kind !== 'robot');
      if (hasCoalStructureCandidate || (pickCandidates.length >= 2 && hasRobotCandidate && hasSpatialCandidate)) {
        dispatchPickCandidates(e.clientX, e.clientY, pickCandidates);
        writeDebug({
          lastSelection: `menu:${pickCandidates.map((candidate) => candidate.id).join('|')}`,
        });
        return;
      }
      clearPickCandidates();

      const nearestRobotByScreen = robots
        ? findNearestRobotByScreen(screenPoint, robots, camera, gl.domElement)
        : null;
      const screenSelection = findNearestFractureSelectionByScreen(screenPoint, fractures, camera, gl.domElement);
      const robotDistanceSq = nearestRobotByScreen?.distanceSq ?? Number.POSITIVE_INFINITY;
      const fractureDistanceSq = screenSelection?.distanceSq ?? Number.POSITIVE_INFINITY;
      const directPreferencePx = 18;
      const directPreferenceSq = directPreferencePx * directPreferencePx;
      const robotClickPrioritySq = 38 ** 2;
      const preciseNodeClickSq = 12 ** 2;
      const shouldPreferDirectFractureNode =
        directHit?.kind === 'robot' &&
        Boolean(screenSelection?.nodeId) &&
        fractureDistanceSq <= preciseNodeClickSq &&
        fractureDistanceSq + directPreferenceSq < robotDistanceSq;
      const shouldPreferDirectRobot =
        directHit?.kind === 'fracture' &&
        (!directHit.nodeId || fractureDistanceSq > preciseNodeClickSq) &&
        Boolean(nearestRobotByScreen) &&
        robotDistanceSq <= robotClickPrioritySq;
      const shouldSelectScreenNodeFirst =
        Boolean(screenSelection?.nodeId) &&
        (!directHit || (directHit.kind === 'fracture' && !directHit.nodeId)) &&
        (!nearestRobotByScreen || (
          fractureDistanceSq <= preciseNodeClickSq &&
          fractureDistanceSq + directPreferenceSq < robotDistanceSq
        ));

      if (directHit?.kind === 'robot' && robots && !shouldPreferDirectFractureNode) {
        const directRobot = robots.find((robot) => robot.id === directHit.robotId);
        if (directRobot) {
          flyTo({ position: directRobot.position, region: `robot-${directRobot.id}`, zoom: 'close' });
          openRobotDetail(directRobot);
          writeDebug({
            lastSelection: `direct-robot:${directRobot.id}`,
          });
          return;
        }
      }

      const shouldSelectNearbyRobotFirst =
        Boolean(nearestRobotByScreen) &&
        robotDistanceSq <= robotClickPrioritySq &&
        !(directHit?.kind === 'fracture' && Boolean(directHit.nodeId) && fractureDistanceSq <= preciseNodeClickSq);

      if (shouldSelectNearbyRobotFirst && nearestRobotByScreen) {
        flyTo({ position: nearestRobotByScreen.robot.position, region: `robot-${nearestRobotByScreen.robot.id}`, zoom: 'close' });
        openRobotDetail(nearestRobotByScreen.robot);
        writeDebug({
          lastSelection: `robot:${nearestRobotByScreen.robot.id}`,
        });
        return;
      }

      if (shouldSelectScreenNodeFirst && screenSelection) {
        const fracture = fractures.find((item) => item.id === screenSelection.fractureId);
        if (fracture) {
          selectFracture(fracture);
          selectFractureNode(screenSelection.nodeId);
          closeRobotDetail();
          flyTo({ position: screenSelection.point, region: screenSelection.nodeId ?? fracture.id, zoom: 'close' });
          setTimeout(() => highlightWithTimer(screenSelection.point, screenSelection.nodeId ? 1.6 : 2.4, 4000), 1800);
          writeDebug({
            lastSelection: `screen-fracture:${screenSelection.fractureId}:${screenSelection.nodeId ?? 'path'}`,
          });
          return;
        }
      }

      if (directHit?.kind === 'coalStructure') {
        const structure = COAL_STRUCTURE_DEFINITIONS.find((item) => item.id === directHit.structureId);
        if (structure) {
          const nearestPoint = findNearestPointOnStructure(screenPoint, structure, camera, gl.domElement);
          selectCoalStructure({
            id: structure.id,
            name: structure.name,
            position: nearestPoint,
            points: structure.points,
            kind: structure.kind,
          });
          writeDebug({ lastSelection: `direct-structure:${structure.id}` });
          return;
        }
      }

      if (directHit?.kind === 'fracture' && !shouldPreferDirectRobot) {
        const directFracture = fractures.find((item) => item.id === directHit.fractureId);
        if (directFracture) {
          const directPoint =
            directHit.nodeId
              ? directFracture.nodes.find((node) => node.id === directHit.nodeId)?.position ?? detail.snap.point
              : detail.snap.point;
          selectFracture(directFracture);
          selectFractureNode(directHit.nodeId);
          closeRobotDetail();
          flyTo({ position: directPoint, region: directHit.nodeId ?? directFracture.id, zoom: 'close' });
          setTimeout(() => highlightWithTimer(directPoint, directHit.nodeId ? 1.6 : 2.4, 4000), 1800);
          writeDebug({
            lastSelection: `direct-fracture:${directFracture.id}:${directHit.nodeId ?? 'path'}`,
          });
          return;
        }
      }

      const nearestRobot = nearestRobotByScreen?.robot ?? (robots ? findNearestRobot(detail.snap.point, robots) : null);
      writeDebug({
        lastNearestRobot: nearestRobot?.id ?? '',
      });

      writeDebug({
        lastScreenFracture: screenSelection?.fractureId ?? '',
      });
      const shouldPreferFracture =
        Boolean(screenSelection) &&
        (!nearestRobotByScreen || (screenSelection?.distanceSq ?? Number.POSITIVE_INFINITY) <= nearestRobotByScreen.distanceSq);

      if (nearestRobot && !shouldPreferFracture) {
        flyTo({ position: nearestRobot.position, region: `robot-${nearestRobot.id}`, zoom: 'close' });
        openRobotDetail(nearestRobot);
        writeDebug({
          lastSelection: `robot:${nearestRobot.id}`,
        });
        return;
      }

      if (screenSelection) {
        const fracture = fractures.find((item) => item.id === screenSelection.fractureId);
        if (fracture) {
          selectFracture(fracture);
          selectFractureNode(screenSelection.nodeId);
          closeRobotDetail();
          flyTo({ position: screenSelection.point, region: screenSelection.nodeId ?? fracture.id, zoom: 'close' });
          setTimeout(() => highlightWithTimer(screenSelection.point, screenSelection.nodeId ? 1.6 : 2.4, 4000), 1800);
          writeDebug({
            lastSelection: `screen-fracture:${screenSelection.fractureId}:${screenSelection.nodeId ?? 'path'}`,
          });
          return;
        }
      }

      const snap = snapMeasurementPoint(detail.snap.point, fractures, 4);
      writeDebug({
        lastSnapTarget: snap.targetType === 'raw' ? 'raw' : `${snap.targetType}:${snap.targetId ?? ''}`,
      });
      if (snap.snapped && snap.targetType === 'node' && snap.targetId) {
        const fracture = fractures.find((item) => item.nodes.some((node) => node.id === snap.targetId));
        if (fracture) {
          selectFracture(fracture);
          selectFractureNode(snap.targetId);
          closeRobotDetail();
          flyTo({ position: snap.point, region: snap.targetId, zoom: 'close' });
          setTimeout(() => highlightWithTimer(snap.point, 1.6, 4000), 1800);
          writeDebug({
            lastSelection: `snap-node:${snap.targetId}`,
          });
          return;
        }
      }

      if (snap.snapped && snap.targetType === 'path' && snap.targetId) {
        const fracture = fractures.find((item) => item.id === snap.targetId);
        if (fracture) {
          selectFracture(fracture);
          selectFractureNode(null);
          closeRobotDetail();
          flyTo({ position: snap.point, region: fracture.id, zoom: 'close' });
          setTimeout(() => highlightWithTimer(snap.point, 2.4, 3500), 1800);
          writeDebug({
            lastSelection: `snap-path:${snap.targetId}`,
          });
          return;
        }
      }

      clearSelection();
      clearHighlight();
      writeDebug({
        lastSelection: 'cleared',
      });
    },
  });

  return null;
}

function CameraFlyToHandler() {
  const { camera, controls } = useThree();
  const animating = useRef(false);
  const startTime = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const cameraTarget = useSceneStore((s) => s.cameraTarget);
  const clearCameraTarget = useSceneStore((s) => s.clearCameraTarget);

  useEffect(() => {
    if (!cameraTarget) return;

    let cx = cameraTarget.position[0];
    let cy = cameraTarget.position[1];
    let cz = cameraTarget.position[2];
    let dist = 30; // 默认偏移距离

    // fitAll: 动态计算当前场景包围盒中心，并按范围自动确定相机距离
    // 用 store fractures（已加载时）；未加载时按场景类型用已知中心+大偏移降级
    const storeState = useSceneStore.getState();
    const currentFractures = storeState.fractures;
    if (cameraTarget.fitAll && currentFractures.length > 0) {
      const pts: number[][] = [];
      for (const f of currentFractures) for (const p of f.path) pts.push(p as unknown as number[]);
      if (pts.length > 0) {
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), zs = pts.map(p => p[2]);
        cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        cz = (Math.min(...zs) + Math.max(...zs)) / 2;
        // 包围盒最大跨度 + 余量，确保全部入镜
        const span = Math.max(
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys),
          Math.max(...zs) - Math.min(...zs),
        );
        dist = Math.max(45, storeState.scenario === 'coal' ? span * 0.72 : span * 1.3);
      }
    } else if (cameraTarget.fitAll) {
      // fitAll 但 fractures 尚未加载：按场景已知中心 + 大偏移降级（足够展示全貌）
      const fallbackCenters: Record<string, [number, number, number]> = {
        coal: [-5, 0, -5], gold: [-5, 0, -5], oil: [-5, 0, -5],
        pipeline: [15, 6, -8], nuclear: [0, -5, 0],
        refinery: [-5, 12, 0], underground: [-4, -30, 4],
      };
      const fc = fallbackCenters[storeState.scenario] ?? [0, 0, 0];
      cx = fc[0]; cy = fc[1]; cz = fc[2];
      dist = 120;
    } else {
      const zoom = cameraTarget.zoom || 'normal';
      const offsets = {
        close: [4, 2.5, 4],     // 贴近看单个机器人/节点
        normal: [15, 8, 15],    // 默认
        wide: [55, 35, 55],     // 远景（容纳大型工业场景）
      };
      const [ox, oy, oz] = offsets[zoom];
      endPos.current.set(cx + ox, cy + oy, cz + oz);
      endTarget.current.set(cx, cy, cz);
      startPos.current.copy(camera.position);
      const orbitControls = asOrbitControls(controls);
      if (orbitControls) {
        startTarget.current.copy(orbitControls.target);
        orbitControls.enabled = false;
      }
      startTime.current = performance.now();
      animating.current = true;
      const timeout = setTimeout(() => {
        animating.current = false;
        const oc = asOrbitControls(controls);
        if (oc) { oc.target.copy(endTarget.current); oc.enabled = true; oc.update(); }
        clearCameraTarget();
      }, 2100);
      return () => clearTimeout(timeout);
    }

    // fitAll 路径：用计算出的中心和距离。煤矿用偏侧竖剖面视角，避免无效上覆岩层占画面。
    if (storeState.scenario === 'coal' && storeState.dataSource === 'fracture') {
      cx = 6;
      cy = -35;
      cz = 10;
      dist = 74;
      endPos.current.set(cx + dist * 0.05, cy + dist * 0.14, cz + dist * 0.9);
    } else {
      endPos.current.set(cx + dist * 0.7, cy + dist * 0.5, cz + dist * 0.7);
    }
    endTarget.current.set(cx, cy, cz);

    startPos.current.copy(camera.position);
    // Save current controls target and disable user input during animation
    const orbitControls = asOrbitControls(controls);
    if (orbitControls) {
      startTarget.current.copy(orbitControls.target);
      orbitControls.enabled = false;
    }

    startTime.current = performance.now();
    animating.current = true;

    const timeout = setTimeout(() => {
      animating.current = false;
      const orbitControls = asOrbitControls(controls);
      if (orbitControls) {
        orbitControls.target.copy(endTarget.current);
        orbitControls.enabled = true;
        orbitControls.update();
      }
      clearCameraTarget();
    }, 2100);

    return () => clearTimeout(timeout);
  }, [cameraTarget, camera, controls, clearCameraTarget]);

  useFrame(() => {
    if (!animating.current) return;
    const elapsed = (performance.now() - startTime.current) / 1000;
    const duration = 2.0;
    const t = Math.min(elapsed / duration, 1);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Animate camera position
    camera.position.lerpVectors(startPos.current, endPos.current, eased);

    // Animate controls target in sync so zoom/rotate/pan stay correct after animation
    const orbitControls = asOrbitControls(controls);
    if (orbitControls) {
      orbitControls.target.lerpVectors(startTarget.current, endTarget.current, eased);
      orbitControls.update();
    } else {
      camera.lookAt(endTarget.current);
    }
  });

  return null;
}
