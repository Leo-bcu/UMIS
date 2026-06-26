import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import type { AIMarker } from '../../types';

const LEVEL_COLORS: Record<AIMarker['level'], string> = {
  danger: '#FF3B30',
  warning: '#FFCC00',
  info: '#58A6FF',
};

export function AIMarkers3D() {
  const markers = useSceneStore((s) => s.aiMarkers);

  if (markers.length === 0) return null;

  return (
    <>
      {markers.map((marker) => (
        <AIMarkerPin key={marker.id} marker={marker} />
      ))}
      <AIMarkerProjectionBridge markers={markers} />
    </>
  );
}

interface ScreenMarker {
  id: string;
  x: number;
  y: number;
  side: 'left' | 'right';
  labelX: number;
  labelY: number;
  visible: boolean;
}

export function AIMarkerScreenOverlay() {
  const markers = useSceneStore((s) => s.aiMarkers);
  const screens = useSceneStore((s) => s.aiMarkerScreens);
  const flyTo = useSceneStore((s) => s.flyTo);
  const highlightWithTimer = useSceneStore((s) => s.highlightWithTimer);
  const clearAIMarkers = useSceneStore((s) => s.clearAIMarkers);
  const locale = useSceneStore((s) => s.locale);

  if (markers.length === 0) return null;

  const markerById = new Map(markers.map((marker) => [marker.id, marker]));
  const screenMarkers = screens
    .map((screen) => ({ screen, marker: markerById.get(screen.id) }))
    .filter((item): item is { screen: ScreenMarker; marker: AIMarker } => Boolean(item.marker));

  return (
    <div className="absolute inset-0 z-40 pointer-events-none">
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {screenMarkers.map(({ screen, marker }) => (
          <line
            key={`${marker.id}-line`}
            x1={screen.x}
            y1={screen.y}
            x2={screen.labelX + (screen.side === 'left' ? 210 : 0)}
            y2={screen.labelY + 20}
            stroke={LEVEL_COLORS[marker.level]}
            strokeWidth="1"
            strokeOpacity={screen.visible ? 0.65 : 0.28}
            strokeDasharray={screen.visible ? '0' : '4 4'}
          />
        ))}
      </svg>
      {screenMarkers.map(({ screen, marker }, index) => {
        const color = LEVEL_COLORS[marker.level];
        return (
          <button
            key={marker.id}
            type="button"
            className="absolute pointer-events-auto text-left bg-[#101820]/92 backdrop-blur-md border shadow-lg hover:shadow-xl transition-none"
            style={{
              left: screen.labelX,
              top: screen.labelY,
              width: 210,
              borderColor: `${color}66`,
              borderLeft: `3px solid ${color}`,
              borderRadius: 6,
              padding: '8px 10px',
            }}
            onClick={() => {
              flyTo({ position: marker.position, region: marker.label, zoom: 'close' });
              highlightWithTimer(marker.position, 2.2, 4500);
            }}
            title={locale === 'zh-CN' ? '点击定位到该AI发现点' : 'Click to locate this AI finding'}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-bold" style={{ color }}>
                {index + 1}. {marker.label}
              </span>
              <span className="text-[8px] text-[#98A2B3] uppercase">{marker.level}</span>
            </div>
            <div className="text-[9px] text-[#D0D5DD] leading-snug line-clamp-2">
              {marker.detail || (locale === 'zh-CN' ? '点击查看该异常点证据' : 'Click to inspect evidence')}
            </div>
            <div className="text-[8px] text-[#58A6FF]/80 mt-1">
              {marker.source || (locale === 'zh-CN' ? 'AI 多源分析' : 'AI multi-source analysis')}
            </div>
          </button>
        );
      })}
      <button
        type="button"
        className="absolute right-3 bottom-16 pointer-events-auto px-2 py-1 text-[10px] rounded border border-[#FF3333]/35 bg-[#101820]/88 text-[#FF8A8A] hover:bg-[#2A1010]"
        onClick={() => clearAIMarkers()}
      >
        {locale === 'zh-CN' ? '清除AI标记' : 'Clear AI markers'}
      </button>
    </div>
  );
}

function AIMarkerProjectionBridge({ markers }: { markers: AIMarker[] }) {
  const { camera, gl } = useThree();
  const setAIMarkerScreens = useSceneStore((s) => s.setAIMarkerScreens);
  const lastPayload = useRef('');
  const lastCommitAt = useRef(0);

  useFrame(() => {
    const rect = gl.domElement.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const h = height;
    const left: ScreenMarker[] = [];
    const right: ScreenMarker[] = [];

    for (const marker of markers) {
      const v = new THREE.Vector3(...marker.position).project(camera);
      const rawX = ((v.x + 1) / 2) * width;
      const rawY = ((-v.y + 1) / 2) * height;
      const visible = v.z >= -1 && v.z <= 1 && rawX >= 0 && rawX <= width && rawY >= 0 && rawY <= height;
      const x = Math.max(18, Math.min(width - 18, Math.round(rawX)));
      const y = Math.max(18, Math.min(height - 18, Math.round(rawY)));
      const side = x < width / 2 ? 'left' : 'right';
      const item: ScreenMarker = {
        id: marker.id,
        x,
        y,
        side,
        labelX: side === 'left' ? 14 : width - 224,
        labelY: 0,
        visible,
      };
      if (side === 'left') left.push(item);
      else right.push(item);
    }

    const layout = (items: ScreenMarker[]) =>
      items
        .sort((a, b) => a.y - b.y)
        .map((item, index) => ({
          ...item,
          labelY: Math.max(64, Math.min(h - 96, 74 + index * 72)),
        }));

    const next = [...layout(left), ...layout(right)];
    const payload = JSON.stringify(next.map((item) => [
      item.id,
      Math.round(item.x),
      Math.round(item.y),
      Math.round(item.labelX),
      Math.round(item.labelY),
      item.visible,
    ]));
    const now = performance.now();
    if (payload !== lastPayload.current && now - lastCommitAt.current > 90) {
      lastPayload.current = payload;
      lastCommitAt.current = now;
      setAIMarkerScreens(next);
    }
  });

  return null;
}

function AIMarkerPin({ marker }: { marker: AIMarker }) {
  const color = LEVEL_COLORS[marker.level];

  return (
    <group position={marker.position}>
      {/* 地面锚点 — 小型十字标记而非球体 */}
      <mesh renderOrder={2}>
        <ringGeometry args={[0.25, 0.4, 4]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} depthTest={true} depthWrite={false} />
      </mesh>

      {/* 中心实心小点 */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color={color} depthTest={true} depthWrite={false} />
      </mesh>
    </group>
  );
}
