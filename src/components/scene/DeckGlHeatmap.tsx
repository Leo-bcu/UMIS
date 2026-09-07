import { useMemo } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import type { Fracture } from '../../types';

/**
 * R3F 原生热力图 — 瓦斯 / 温度
 *
 * 直接用 THREE.Points 渲染彩色点云，完全融入 3D 场景。
 * 替代了之前独立 Deck.gl Canvas 的方案（会"错层"：旋转/平移时不同步）。
 *
 * 数据来源：裂缝路径上的传感器节点（不在完整岩层中）
 */

// 瓦斯色谱：深蓝 → 青 → 黄 → 红
const GAS_COLORS: [number, number, number][] = [
  [13 / 255, 27 / 255, 80 / 255],
  [20 / 255, 80 / 255, 140 / 255],
  [30 / 255, 170 / 255, 200 / 255],
  [220 / 255, 200 / 255, 50 / 255],
  [255 / 255, 130 / 255, 30 / 255],
  [255 / 255, 50 / 255, 30 / 255],
];

// 温度色谱：深紫 → 红 → 橙 → 白
const TEMP_COLORS: [number, number, number][] = [
  [20 / 255, 0, 60 / 255],
  [60 / 255, 0, 120 / 255],
  [180 / 255, 30 / 255, 80 / 255],
  [255 / 255, 100 / 255, 30 / 255],
  [255 / 255, 220 / 255, 100 / 255],
  [255 / 255, 255 / 255, 220 / 255],
];

/** 根据权重在色谱中线性插值颜色 */
function lerpColor(weight: number, minW: number, maxW: number, colors: [number, number, number][]): [number, number, number] {
  if (maxW <= minW) return colors[0];
  const t = Math.max(0, Math.min(1, (weight - minW) / (maxW - minW)));
  const idx = t * (colors.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, colors.length - 1);
  const f = idx - lo;
  const a = colors[lo];
  const b = colors[hi];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** 从裂缝提取热力点 */
function extractPoints(fractures: Fracture[]) {
  type Point = { position: [number, number, number]; ch4: number; temp: number };
  const points: Point[] = [];
  for (const f of fractures) {
    for (const node of f.nodes) {
      points.push({
        position: node.position,
        ch4: node.sensors.ch4_pct,
        temp: node.sensors.temperature_c,
      });
    }
  }
  return points;
}

/** 构建单个热力图层的 Points geometry */
function buildHeatmapGeo(
  points: { position: [number, number, number]; weight: number }[],
  colorRange: [number, number, number][],
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(points.length * 3);
  const colors = new Float32Array(points.length * 3);

  const weights = points.map((p) => p.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    positions[i * 3] = p.position[0];
    positions[i * 3 + 1] = p.position[1];
    positions[i * 3 + 2] = p.position[2];

    const col = lerpColor(p.weight, minW, maxW, colorRange);
    colors[i * 3] = col[0];
    colors[i * 3 + 1] = col[1];
    colors[i * 3 + 2] = col[2];
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function GasHeatmap({ points }: { points: { position: [number, number, number]; ch4: number }[] }) {
  const geo = useMemo(
    () =>
      buildHeatmapGeo(
        points.map((p) => ({ position: p.position, weight: p.ch4 })),
        GAS_COLORS,
      ),
    [points],
  );

  return (
    <points geometry={geo}>
      <pointsMaterial
        vertexColors
        size={1.2}
        sizeAttenuation
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function TempHeatmap({ points }: { points: { position: [number, number, number]; temp: number }[] }) {
  const geo = useMemo(
    () =>
      buildHeatmapGeo(
        points.map((p) => ({ position: p.position, weight: p.temp })),
        TEMP_COLORS,
      ),
    [points],
  );

  return (
    <points geometry={geo}>
      <pointsMaterial
        vertexColors
        size={1.2}
        sizeAttenuation
        transparent
        opacity={0.45}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export function DeckGlHeatmap() {
  const layers = useSceneStore((s) => s.layers);
  const physicalTruthMode = useSceneStore((s) => s.physicalTruthMode);
  const fractures = useSceneStore((s) => s.fractures);

  const showGas = layers.gasHeatmap && !physicalTruthMode;
  const showTemp = layers.tempHeatmap && !physicalTruthMode;

  const heatmapPoints = useMemo(() => {
    if ((!showGas && !showTemp) || fractures.length === 0) return null;
    return extractPoints(fractures);
  }, [fractures, showGas, showTemp]);

  if (!heatmapPoints || heatmapPoints.length === 0) return null;

  return (
    <>
      {showGas && <GasHeatmap points={heatmapPoints} />}
      {showTemp && <TempHeatmap points={heatmapPoints} />}
    </>
  );
}
