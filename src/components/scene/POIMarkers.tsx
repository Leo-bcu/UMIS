import { useState, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePOIs } from '../../hooks/usePOIs';
import { useSceneStore } from '../../store/useSceneStore';
import { t } from '../../domain/i18nCatalog';
import type { POI } from '../../types';

export function POIMarkers() {
  const [activePOI, setActivePOI] = useState<string | null>(null);
  const { data: poiList } = usePOIs();

  const colorMap: Record<string, string> = {
    crack: '#FF8800',
    gas: '#FF3333',
    collapse: '#FF0000',
    sensor: '#1E3A5F',
  };

  return (
    <>
      {poiList.map((poi) => (
        <POISphere
          key={poi.id}
          poi={poi}
          color={colorMap[poi.type]}
          isActive={activePOI === poi.id}
          onClick={() => setActivePOI(activePOI === poi.id ? null : poi.id)}
        />
      ))}
    </>
  );
}

function POISphere({
  poi,
  color,
  isActive,
  onClick,
}: {
  poi: POI;
  color: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const locale = useSceneStore((s) => s.locale);

  return (
    <group position={poi.position}>
      {/* Click target — depthTest 启用 */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick(); }} renderOrder={2}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} depthTest={true} depthWrite={false} />
      </mesh>

      {/* Outer ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
        <ringGeometry args={[1.8, 2.2, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={2} depthTest={true} depthWrite={false} />
      </mesh>

      {/* Pulse marker */}
      <PulseRing color={color} />

      {isActive && (
        <Html distanceFactor={15} position={[0, 3, 0]} center occlude>
          <div className="glass-panel px-4 py-3 min-w-[200px] text-xs animate-fade-in" style={{ pointerEvents: 'auto' }}>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
              <span className="text-primary-yellow font-semibold">{poi.label}</span>
            </div>
            <div className="text-text-muted mb-2">{poi.description}</div>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div>
                <div className="text-text-muted">{t('poi.methane', locale)}</div>
                <div className={poi.sensors.ch4_concentration_pct > 1.5 ? 'text-primary-red font-bold' : 'text-text'}>
                  {poi.sensors.ch4_concentration_pct}%
                </div>
              </div>
              <div>
                <div className="text-text-muted">{t('poi.temperature', locale)}</div>
                <div className={poi.sensors.temperature_celsius > 40 ? 'text-primary-orange font-bold' : 'text-text'}>
                  {poi.sensors.temperature_celsius}°C
                </div>
              </div>
              <div>
                <div className="text-text-muted">{t('poi.pressure', locale)}</div>
                <div className="text-text">{poi.sensors.pressure_kpa}kPa</div>
              </div>
            </div>
            <div className="mt-2 text-[9px] text-text-muted/50">
              ID: {poi.id} | [{poi.position.map((v) => v.toFixed(1)).join(', ')}]
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function PulseRing({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (meshRef.current && matRef.current) {
      const t = (state.clock.elapsedTime % 2) / 2;
      meshRef.current.scale.setScalar(1 + t * 3);
      matRef.current.opacity = (1 - t) * 0.4;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
      <ringGeometry args={[1.5, 1.8, 32]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0.4} side={2} depthTest={true} depthWrite={false} />
    </mesh>
  );
}
