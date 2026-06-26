import { useMemo } from 'react';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { useSceneStore } from '../../store/useSceneStore';
import { GEO_IDENTITY } from '../../lib/sceneColors';

/**
 * 岩层/土层 — 真实的地质体渲染
 *
 * 使用 simplex-noise 库生成高质量程序化噪声，替代手搓 sin/cos 组合。
 * 多层半透明渲染出地层质感。裂缝网络嵌在岩体内部。
 */
export function RockMass() {
  const visible = useSceneStore((s) => s.layers.rockMass);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);

  // 地下暗流场景使用更大更深的岩体，完全包裹通道
  const isUnderground = dataSource === 'underground';

  const { outerShell, innerShell, strata1, strata2, strata3 } = useMemo(() => {
    const noise3D = createNoise3D(() => 0.42);

    if (isUnderground) {
      // 地下场景: 大块深部岩体，覆盖整个通道范围
      // 通道范围 x[-55,55], y[-38,-3], z[-45,45]
      const w = 130, h = 90, d = 110;
      const outerGeo = createRockGeometry(w, h, d, 24, 10, 20, noise3D, 3.5);
      const innerGeo = createRockGeometry(w * 0.9, h * 0.85, d * 0.9, 18, 8, 14, noise3D, 2.5);
      const s1 = createStratumLayer(w, h, d, -15, noise3D);
      const s2 = createStratumLayer(w, h, d, -25, noise3D);
      const s3 = createStratumLayer(w, h, d, -5, noise3D);
      return { outerShell: outerGeo, innerShell: innerGeo, strata1: s1, strata2: s2, strata3: s3 };
    }

    if (dataSource === 'fracture' && scenario === 'coal') {
      const w = 136, h = 66, d = 108;
      const outerGeo = createRockGeometry(w, h, d, 22, 10, 18, noise3D, 1.6);
      const innerGeo = createRockGeometry(w * 0.92, h * 0.84, d * 0.92, 16, 9, 12, noise3D, 1.4);
      const s1 = createStratumLayer(w, h, d, -8, noise3D);
      const s2 = createStratumLayer(w, h, d, -24, noise3D);
      const s3 = createStratumLayer(w, h, d, -40, noise3D);
      return { outerShell: outerGeo, innerShell: innerGeo, strata1: s1, strata2: s2, strata3: s3 };
    }

    // 默认（裂缝场景）
    const w = 100, h = 40, d = 80;
    const outerGeo = createRockGeometry(w, h, d, 20, 8, 16, noise3D, 2.5);
    const innerGeo = createRockGeometry(w * 0.92, h * 0.88, d * 0.92, 16, 6, 12, noise3D, 1.8);
    const s1 = createStratumLayer(w, h, d, -4, noise3D);
    const s2 = createStratumLayer(w, h, d, 4, noise3D);
    const s3 = createStratumLayer(w, h, d, 12, noise3D);
    return { outerShell: outerGeo, innerShell: innerGeo, strata1: s1, strata2: s2, strata3: s3 };
  }, [dataSource, scenario, isUnderground]);

  if (!visible || dataSource === 'nuclear' || dataSource === 'refinery') return null;

  const isCoal = dataSource === 'fracture' && scenario === 'coal';
  const isOil = dataSource === 'fracture' && scenario === 'oil';
  const outerOpacity = isCoal ? 0.045 : isOil ? 0.38 : 0.55;
  const innerOpacity = isCoal ? 0.025 : isOil ? 0.28 : 0.42;
  const strataOpacity = isCoal
    ? { s1: 0.055, s2: 0.045, s3: 0.04, base: 0.055 }
    : { s1: 0.35, s2: 0.28, s3: 0.22, base: 0.4 };

  if (isUnderground) {
    // 地下暗流场景: 岩体中心下沉到 y=-20，完全包裹地下通道
    return (
      <group position={[0, -20, 0]}>
        {/* 外层深部岩壳 — 降低不透明度以暴露内部水流通道 */}
        <mesh geometry={outerShell} renderOrder={0}>
          <meshStandardMaterial
            color={GEO_IDENTITY.deepRock}
            roughness={0.95}
            metalness={0.02}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* 内层岩壳 */}
        <mesh geometry={innerShell} renderOrder={0}>
          <meshStandardMaterial
            color={GEO_IDENTITY.sedimentaryLight}
            roughness={0.9}
            metalness={0.03}
            transparent
            opacity={0.38}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* 地层分界线 — 水平岩层 */}
        <mesh geometry={strata3} rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
          <meshStandardMaterial color={GEO_IDENTITY.strata3} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} roughness={1} />
        </mesh>
        <mesh geometry={strata1} rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, 0]}>
          <meshStandardMaterial color={GEO_IDENTITY.strata1} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} roughness={1} />
        </mesh>
        <mesh geometry={strata2} rotation={[-Math.PI / 2, 0, 0]} position={[0, -25, 0]}>
          <meshStandardMaterial color={GEO_IDENTITY.basement} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} roughness={1} />
        </mesh>
        {/* 底部基岩 */}
        <mesh position={[0, -42, 0]}>
          <boxGeometry args={[130, 2, 110]} />
          <meshStandardMaterial color={GEO_IDENTITY.basement} roughness={1} metalness={0} transparent opacity={0.4} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      {/* 外层岩壳 — 半透明不写深度，避免遮挡裂缝面 */}
      <mesh geometry={outerShell} renderOrder={0}>
        <meshStandardMaterial
          color={GEO_IDENTITY.sedimentary}
          roughness={0.9}
          metalness={0.02}
          transparent
          opacity={outerOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 内层岩壳 */}
      <mesh geometry={innerShell} renderOrder={0}>
        <meshStandardMaterial
          color={GEO_IDENTITY.sedimentaryLight}
          roughness={0.85}
          metalness={0.05}
          transparent
          opacity={innerOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 地层分界线 — 3 条水平岩层 */}
      <mesh geometry={strata1} rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}>
        <meshStandardMaterial
          color={GEO_IDENTITY.strata1}
          transparent
          opacity={strataOpacity.s1}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={1}
        />
      </mesh>
      <mesh geometry={strata2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
        <meshStandardMaterial
          color={GEO_IDENTITY.strata2}
          transparent
          opacity={strataOpacity.s2}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={1}
        />
      </mesh>
      <mesh geometry={strata3} rotation={[-Math.PI / 2, 0, 0]} position={[0, 12, 0]}>
        <meshStandardMaterial
          color={GEO_IDENTITY.strata3}
          transparent
          opacity={strataOpacity.s3}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={1}
        />
      </mesh>

      {/* 底部岩床 */}
      <mesh position={[0, isCoal ? -58 : -20, 0]}>
        <boxGeometry args={isCoal ? [136, 1.0, 108] : [100, 1, 80]} />
        <meshStandardMaterial
          color={GEO_IDENTITY.basement}
          roughness={1}
          metalness={0}
          transparent
          opacity={strataOpacity.base}
        />
      </mesh>
    </group>
  );
}

/**
 * 创建不规则岩体几何 — simplex-noise 顶点位移
 */
function createRockGeometry(
  w: number, h: number, d: number,
  segW: number, segH: number, segD: number,
  noise3D: (x: number, y: number, z: number) => number,
  noiseScale: number
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, segW, segH, segD);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // simplex-noise：多倍频叠加（fBm），效果比 sin/cos 自然得多
    const nx = noise3D(x * 0.05, y * 0.05, z * 0.05) * noiseScale * 0.6
             + noise3D(x * 0.12, y * 0.12, z * 0.12) * noiseScale * 0.25
             + noise3D(x * 0.25, y * 0.25, z * 0.25) * noiseScale * 0.1;

    const isEdge = Math.abs(x) > w * 0.45 || Math.abs(y) > h * 0.45 || Math.abs(z) > d * 0.45;
    if (isEdge) {
      pos.setX(i, x + nx);
      pos.setY(i, y + nx * 0.6);
      pos.setZ(i, z + nx * 0.8);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * 创建水平地层薄层 — simplex-noise 起伏
 */
function createStratumLayer(
  w: number, h: number, d: number,
  yOffset: number,
  noise3D: (x: number, y: number, z: number) => number
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(w * 0.9, d * 0.9, 20, 16);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getY(i);

    // simplex-noise 地层起伏（fBm 多倍频）
    const undulation =
      noise3D(x * 0.03, z * 0.03, yOffset * 0.1) * 3 +
      noise3D(x * 0.08, z * 0.08, yOffset * 0.1) * 1.2 +
      noise3D(x * 0.2, z * 0.2, yOffset * 0.1) * 0.5;

    pos.setZ(i, undulation);
  }

  geo.computeVertexNormals();
  return geo;
}
