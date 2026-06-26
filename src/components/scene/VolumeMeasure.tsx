import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { useCanvasInteraction, type CanvasInteractionPoint } from './useCanvasInteraction';
import { getMeasureConfig } from '../../lib/sceneMeasureConfig';
import { MeasurementSnapIndicator } from './MeasurementSnapIndicator';
import type { MeasurementSnapResult } from '../../lib/measurementPicking';
import type { Annotation, SensorReading } from '../../types';

/** 岩体 Y 范围（RockMass: 100×40×80 居中，Y 从 -20 到 +20） */
const SCENE_Y_MIN = -20;
const SCENE_Y_MAX = 20;
const DEFAULT_HEIGHT = 15;

/**
 * 3D 区域框选工具 — 拖拽画框，可调节高度和位置
 *
 * 交互流程：
 * 1. 左键拖拽：在岩体表面画 XZ 矩形，Y 中心取自拖拽起点的表面 Y 值
 * 2. 松手后：显示结果面板，内含高度滑块和 Y 位置滑块
 * 3. 高度滑块（1~40m）：调节框选的垂直范围
 * 4. Y 位置滑块：上下移动框选区域
 * 5. 确认保存 / 重选
 */
export function VolumeMeasure() {
  const activeTool = useSceneStore((s) => s.activeTool);
  const setActiveTool = useSceneStore((s) => s.setActiveTool);
  const addAnnotation = useSceneStore((s) => s.addAnnotation);

  const isActive = activeTool === 'area';

  // XZ 范围由拖拽确定
  const [xzRange, setXzRange] = useState<{
    minX: number; maxX: number;
    minZ: number; maxZ: number;
  } | null>(null);

  // Y 范围可调
  const [yCenter, setYCenter] = useState(0);
  const [yHeight, setYHeight] = useState(DEFAULT_HEIGHT);

  // 用 ref 同步 drag 状态
  const draggingRef = useRef(false);
  const startRef = useRef<THREE.Vector3 | null>(null);
  const [draggingUI, setDraggingUI] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [snap, setSnap] = useState<MeasurementSnapResult | null>(null);

  useEffect(() => {
    if (isActive) {
      draggingRef.current = false;
      startRef.current = null;
      setXzRange(null);
      setDraggingUI(false);
      setYCenter(0);
      setYHeight(DEFAULT_HEIGHT);
      setHoverPoint(null);
      setSnap(null);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        draggingRef.current = false;
        startRef.current = null;
        setXzRange(null);
        setDraggingUI(false);
        setHoverPoint(null);
        setSnap(null);
        setActiveTool('none');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, setActiveTool]);

  useCanvasInteraction(isActive, {
    onPointerDown: useCallback((pt: THREE.Vector3) => {
      draggingRef.current = true;
      startRef.current = pt.clone();
      setXzRange(null);
      setDraggingUI(true);
      // 初始 Y 中心 = 点击点的 Y
      setYCenter(pt.y);
    }, []),
    onPointerMove: useCallback((pt: THREE.Vector3) => {
      setHoverPoint(pt);
      if (!draggingRef.current || !startRef.current) return;
      const sp = startRef.current;
      setXzRange({
        minX: Math.min(sp.x, pt.x),
        maxX: Math.max(sp.x, pt.x),
        minZ: Math.min(sp.z, pt.z),
        maxZ: Math.max(sp.z, pt.z),
      });
    }, []),
    onPointerUp: useCallback(() => {
      draggingRef.current = false;
      setDraggingUI(false);
    }, []),
    onPointerMoveDetail: useCallback((detail: CanvasInteractionPoint) => {
      setHoverPoint(detail.point);
      setSnap(detail.snap);
    }, []),
  });

  // 计算当前 box
  const halfH = yHeight / 2;
  const box = useMemo(() => xzRange ? {
    min: [xzRange.minX, Math.max(SCENE_Y_MIN, yCenter - halfH), xzRange.minZ] as [number, number, number],
    max: [xzRange.maxX, Math.min(SCENE_Y_MAX, yCenter + halfH), xzRange.maxZ] as [number, number, number],
  } : null, [halfH, xzRange, yCenter]);

  const handleFinish = useCallback(() => {
    if (box) {
      const volume = Math.abs(
        (box.max[0] - box.min[0]) *
        (box.max[1] - box.min[1]) *
        (box.max[2] - box.min[2])
      );
      const annotation: Annotation = {
        id: `anno-area-${Date.now()}`,
        type: 'area',
        points: [box.min, box.max],
        label: `${volume.toFixed(1)} m³`,
        createdAt: Date.now(),
      };
      addAnnotation(annotation);
    }
    setXzRange(null);
    startRef.current = null;
    setActiveTool('none');
    setHoverPoint(null);
    setSnap(null);
  }, [box, addAnnotation, setActiveTool]);

  const handleReset = useCallback(() => {
    setXzRange(null);
    startRef.current = null;
    setDraggingUI(false);
    draggingRef.current = false;
    setYHeight(DEFAULT_HEIGHT);
    setHoverPoint(null);
    setSnap(null);
  }, []);

  const volume = box
    ? Math.abs((box.max[0] - box.min[0]) * (box.max[1] - box.min[1]) * (box.max[2] - box.min[2]))
    : 0;

  const fractures = useSceneStore((s) => s.fractures);
  const scenario = useSceneStore((s) => s.scenario);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const locale = useSceneStore((s) => s.locale);
  const measureCfg = getMeasureConfig(scenario, gasThreshold);
  const isZh = locale === 'zh-CN';

  // === 区域内测点分析 ===
  const analysis = useMemo(() => {
    if (!box) return null;

    // 收集区域内的所有节点
    const inBoxNodes: { sensors: SensorReading; pos: number[] }[] = [];
    for (const f of fractures) {
      for (const n of f.nodes) {
        if (n.position[0] >= box.min[0] && n.position[0] <= box.max[0] &&
            n.position[1] >= box.min[1] && n.position[1] <= box.max[1] &&
            n.position[2] >= box.min[2] && n.position[2] <= box.max[2]) {
          inBoxNodes.push({ sensors: n.sensors, pos: n.position });
        }
      }
    }

    const nodeCount = inBoxNodes.length;
    const volM3 = volume;
    const density = volM3 > 0 ? nodeCount / volM3 * 1000 : 0; // nodes per 1000m³

    // 主传感器字段（场景化）
    const sensorKey = measureCfg.primaryKey;
    const vals = inBoxNodes.map(n => (n.sensors as unknown as Record<string, number>)[sensorKey] || 0);
    const maxSensor = vals.length > 0 ? Math.max(...vals) : 0;
    const avgSensor = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const threshold = measureCfg.primaryThreshold as number;
    const overThreshold = vals.filter(v => v > threshold).length;

    // 次传感器均值
    const secKey = measureCfg.secondaryKey;
    const secVals = inBoxNodes.map(n => (n.sensors as unknown as Record<string, number>)[secKey] || 0);
    const avgSecondary = secVals.length > 0 ? secVals.reduce((a, b) => a + b, 0) / secVals.length : 0;

    // 温度均值
    const tempVals = inBoxNodes.map(n => n.sensors.temperature_c || 0);
    const avgTemp = tempVals.length > 0 ? tempVals.reduce((a, b) => a + b, 0) / tempVals.length : 0;

    // RQD 估算（仅地质场景）
    const rqd = measureCfg.showRockGrade ? Math.max(0, Math.min(100, 100 - density * 2)) : 0;

    // 风险等级
    const riskPct = nodeCount > 0 ? overThreshold / nodeCount : 0;
    const riskLevel = overThreshold === 0
      ? { label: isZh ? '安全' : 'Safe', color: '#00CC66' }
      : riskPct <= 0.2
        ? { label: isZh ? '低风险' : 'Low Risk', color: '#FFCC00' }
        : riskPct <= 0.5
          ? { label: isZh ? '中风险' : 'Medium Risk', color: '#FF8800' }
          : { label: isZh ? '高风险' : 'High Risk', color: '#FF3333' };

    // 岩质等级（仅地质场景）
    const rockGrade = isZh
      ? (rqd > 75 ? 'Ⅰ优' : rqd > 50 ? 'Ⅱ良' : rqd > 25 ? 'Ⅲ差' : 'Ⅳ劣')
      : (rqd > 75 ? 'Grade I' : rqd > 50 ? 'Grade II' : rqd > 25 ? 'Grade III' : 'Grade IV');
    const rockColor = rqd > 75 ? '#00CC66' : rqd > 50 ? '#88CC00' : rqd > 25 ? '#FFA500' : '#FF3333';

    return { nodeCount, density, maxSensor, avgSensor, overThreshold, avgSecondary, avgTemp, rqd, riskLevel, rockGrade, rockColor, sensorKey, threshold };
  }, [box, fractures, isZh, measureCfg, volume]);

  if (!isActive && !box) return null;

  // Y 滑块范围
  const yCenterMin = SCENE_Y_MIN + halfH;
  const yCenterMax = SCENE_Y_MAX - halfH;

  return (
    <>
      {isActive && !box && <MeasurementSnapIndicator point={hoverPoint} snap={snap} locale={locale} />}
      {/* 框选结果 — 实时渲染（包括拖拽中） */}
      {box && (
        <group>
          {/* 粗边框 */}
          <lineSegments
            position={[(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2]}
            userData={{ noRaycast: true }}
          >
            <edgesGeometry args={[new THREE.BoxGeometry(
              Math.max(0.1, box.max[0] - box.min[0]),
              Math.max(0.1, box.max[1] - box.min[1]),
              Math.max(0.1, box.max[2] - box.min[2])
            )]} />
            <lineBasicMaterial color="#FFE600" linewidth={3} transparent opacity={0.95} />
          </lineSegments>

          {/* 边角高亮球 */}
          {[
            [box.min[0], box.min[1], box.min[2]], [box.max[0], box.min[1], box.min[2]],
            [box.min[0], box.max[1], box.min[2]], [box.max[0], box.max[1], box.min[2]],
            [box.min[0], box.min[1], box.max[2]], [box.max[0], box.min[1], box.max[2]],
            [box.min[0], box.max[1], box.max[2]], [box.max[0], box.max[1], box.max[2]],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} userData={{ noRaycast: true }}>
              <sphereGeometry args={[0.18, 10, 10]} />
              <meshBasicMaterial color="#FFE600" />
            </mesh>
          ))}

          {/* 半透明填充 */}
          <mesh position={[(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2]} userData={{ noRaycast: true }}>
            <boxGeometry args={[
              Math.max(0.1, box.max[0] - box.min[0]),
              Math.max(0.1, box.max[1] - box.min[1]),
              Math.max(0.1, box.max[2] - box.min[2])
            ]} />
            <meshBasicMaterial color="#FFE600" transparent opacity={0.06} depthWrite={false} />
          </mesh>

          {/* 拖拽中：实时显示尺寸 */}
          {draggingUI && (
            <Html position={[(box.min[0] + box.max[0]) / 2, box.max[1] + 2, (box.min[2] + box.max[2]) / 2]} center>
              <div className="glass-panel px-3 py-1.5 text-[10px] text-[#FFE600] font-mono whitespace-nowrap" style={{ pointerEvents: 'none' }}>
                {isZh
                  ? `${(box.max[0] - box.min[0]).toFixed(0)}×${(box.max[2] - box.min[2]).toFixed(0)} m² · 拖拽确定范围`
                  : `${(box.max[0] - box.min[0]).toFixed(0)}×${(box.max[2] - box.min[2]).toFixed(0)} m² · drag to confirm the footprint`}
              </div>
            </Html>
          )}
          {!draggingUI && volume > 0 && (
            <Html position={[(box.min[0] + box.max[0]) / 2, box.max[1] + 2, (box.min[2] + box.max[2]) / 2]} center>
              <div data-testid="area-measure-report" className="glass-panel px-4 py-3 text-xs min-w-[260px]" style={{ pointerEvents: 'auto' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#FFE600] font-bold text-[11px]">{measureCfg.areaTitle}</span>
                  {analysis && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: `${analysis.riskLevel.color}20`, color: analysis.riskLevel.color }}>
                      {analysis.riskLevel.label}
                    </span>
                  )}
                </div>

                {/* 基础数据 */}
                <div className="space-y-1 text-[10px] mb-2">
                  <div className="flex justify-between">
                    <span className="text-[#A0A0B0]">{isZh ? '体积' : 'Volume'}</span>
                    <span className="text-[#FFE600] font-mono font-bold">{volume.toFixed(0)} m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A0A0B0]">{isZh ? '底面积' : 'Footprint'}</span>
                    <span className="text-[#E0E0E8] font-mono">{(box.max[0] - box.min[0]).toFixed(0)}×{(box.max[2] - box.min[2]).toFixed(0)} m²</span>
                  </div>
                </div>

                {/* 场景化分析数据 */}
                {analysis && analysis.nodeCount > 0 && (
                  <div className="space-y-1 text-[10px] mb-2 pt-2 border-t border-white/5">
                    <div className="flex justify-between">
                      <span className="text-[#A0A0B0]">{measureCfg.pointLabel}</span>
                      <span className="text-[#E0E0E8] font-mono">{isZh ? `${analysis.nodeCount} 个` : `${analysis.nodeCount}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A0A0B0]">{measureCfg.densityLabel}</span>
                      <span className="text-[#FF8800] font-mono">{isZh ? `${analysis.density.toFixed(1)} /千m³` : `${analysis.density.toFixed(1)} /1000m³`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A0A0B0]">{isZh ? `${measureCfg.primaryLabel}峰值` : `${measureCfg.primaryLabel} peak`}</span>
                      <span className={`font-mono ${analysis.overThreshold > 0 ? 'text-[#FF3333]' : 'text-[#00CC66]'} font-bold`}>{analysis.maxSensor.toFixed(2)} {measureCfg.primaryUnit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A0A0B0]">{isZh ? `${measureCfg.primaryLabel}均值` : `${measureCfg.primaryLabel} avg`}</span>
                      <span className="text-[#88AAFF] font-mono">{analysis.avgSensor.toFixed(2)} {measureCfg.primaryUnit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A0A0B0]">{isZh ? '超阈值点' : 'Over-limit points'}</span>
                      <span className={`font-mono ${analysis.overThreshold > 0 ? 'text-[#FF4422]' : 'text-[#00CCAA]'}`}>{analysis.overThreshold} / {analysis.nodeCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A0A0B0]">{measureCfg.secondaryLabel}</span>
                      <span className="text-[#E0E0E8] font-mono">{analysis.avgSecondary.toFixed(3)} {measureCfg.secondaryUnit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A0A0B0]">{measureCfg.tempLabel}</span>
                      <span className="text-[#E0E0E8] font-mono">{analysis.avgTemp.toFixed(1)} °C</span>
                    </div>
                    {measureCfg.showRockGrade && (
                      <div className="flex justify-between">
                        <span className="text-[#A0A0B0]">{isZh ? 'RQD 岩质' : 'RQD Rock Grade'}</span>
                        <span className="font-mono font-bold" style={{ color: analysis.rockColor }}>
                          {analysis.rqd.toFixed(0)} · {analysis.rockGrade}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {analysis && analysis.nodeCount === 0 && (
                  <div className="text-[9px] text-[#A0A0B0]/50 text-center py-2 border-t border-white/5">
                    {isZh ? `此区域无${measureCfg.pointLabel}` : `No ${measureCfg.pointLabel} inside this region`}
                  </div>
                )}

                {/* 高度调节 */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-[#A0A0B0]">{isZh ? '框选高度' : 'Selection Height'}</span>
                      <span className="text-[#FFE600] font-mono">{yHeight.toFixed(0)} m</span>
                    </div>
                    <input
                      type="range" min={1} max={SCENE_Y_MAX - SCENE_Y_MIN} step={1}
                      value={yHeight}
                      onChange={(e) => setYHeight(Number(e.target.value))}
                      className="w-full h-1 accent-yellow-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-[#A0A0B0]">{isZh ? '垂直位置' : 'Vertical Position'}</span>
                      <span className="text-[#FFE600] font-mono">Y: {yCenter.toFixed(0)} ({(yCenter - halfH).toFixed(0)}~{(yCenter + halfH).toFixed(0)})</span>
                    </div>
                    <input
                      type="range" min={yCenterMin} max={yCenterMax} step={0.5}
                      value={yCenter}
                      onChange={(e) => setYCenter(Number(e.target.value))}
                      className="w-full h-1 accent-yellow-400 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-2.5 pt-2 border-t border-white/5">
                  <button data-testid="area-measure-confirm" className="flex-1 px-2 py-1.5 text-[10px] bg-[#FFE600]/20 text-[#FFE600] rounded hover:bg-[#FFE600]/30 transition-all" onClick={handleFinish}>{isZh ? '确认并保存' : 'Confirm & Save'}</button>
                  <button data-testid="area-measure-reset" className="px-2 py-1.5 text-[10px] bg-white/5 text-[#A0A0B0] rounded hover:text-[#E0E0E8] hover:bg-white/10 transition-all" onClick={handleReset}>{isZh ? '重选' : 'Reselect'}</button>
                </div>
              </div>
            </Html>
          )}
        </group>
      )}

      {/* 提示 */}
      {isActive && !box && !draggingUI && (
        <Html position={[0, 0, 0]} center>
          <div className="glass-panel px-3 py-2 text-[10px] text-[#FFE600] animate-pulse whitespace-nowrap" style={{ pointerEvents: 'none' }}>
            {isZh ? 'F2 区域框选 · 左键拖拽画框 · 松手后可调高度 · 右键旋转（ESC取消）' : 'F2 Area Select · left-drag to draw a region · adjust height after release · right-drag to orbit (ESC to cancel)'}
          </div>
        </Html>
      )}
    </>
  );
}
