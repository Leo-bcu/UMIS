import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { createFindingFromAnnotation } from '../../domain/findingFactory';
import { t } from '../../domain/i18nCatalog';
import { INTERACTION, ROBOT_STATUS, STATUS } from '../../lib/sceneColors';

const SCENE_Y_MIN = -20;
const SCENE_Y_MAX = 20;

/**
 * 持久渲染已保存的标注（distance / profile / text / area）
 */
export function AnnotationOverlay() {
  const annotations = useSceneStore((s) => s.annotations);
  const removeAnnotation = useSceneStore((s) => s.removeAnnotation);
  const addFinding = useSceneStore((s) => s.addFinding);
  const locale = useSceneStore((s) => s.locale);

  if (annotations.length === 0) return null;

  return (
    <group>
      {annotations.map((anno) => {
        if ((anno.type === 'distance' || anno.type === 'profile') && anno.points.length >= 2) {
          const p0 = new THREE.Vector3(...anno.points[0]);
          const p1 = new THREE.Vector3(...anno.points[1]);
          const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
          const dir = new THREE.Vector3().subVectors(p1, p0);
          const len = dir.length();
          dir.normalize();
          const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          const isProfile = anno.type === 'profile';
          const color = isProfile ? STATUS.warning : ROBOT_STATUS.maintenance;
          const lineRadius = isProfile ? 0.09 : 0.06;
          const haloRadius = isProfile ? 0.16 : 0.11;
          const pointRadius = isProfile ? 0.16 : 0.13;
          const pointGlowRadius = isProfile ? 0.28 : 0.22;

          // 剖面线：额外渲染轻量截面参考面
          let profilePlane = null;
          if (isProfile) {
            const height = SCENE_Y_MAX - SCENE_Y_MIN;
            const hw = len / 2;
            const hh = height / 2;
            const angle = Math.atan2(dir.x, dir.z);
            const planePositions = new Float32Array([
              -hw, -hh, 0,  hw, -hh, 0,  hw, hh, 0,
              -hw, -hh, 0,  hw, hh, 0,  -hw, hh, 0,
            ]);
            const edgePositions = new Float32Array([
              -hw, -hh, 0,  hw, -hh, 0,
               hw, -hh, 0,  hw,  hh, 0,
               hw,  hh, 0, -hw,  hh, 0,
              -hw,  hh, 0, -hw, -hh, 0,
            ]);
            profilePlane = (
              <group position={[mid.x, 0, mid.z]} rotation={[0, -angle, 0]}>
                <mesh>
                  <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={6} array={planePositions} itemSize={3} />
                  </bufferGeometry>
                  <meshBasicMaterial color={STATUS.warning} transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
                <lineSegments>
                  <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={8} array={edgePositions} itemSize={3} />
                  </bufferGeometry>
                  <lineBasicMaterial color={STATUS.warning} transparent opacity={0.28} />
                </lineSegments>
              </group>
            );
          }

          return (
            <group key={anno.id}>
              {len > 0.01 && (
                <>
                  {/* 线主体 */}
                  <mesh position={mid} quaternion={quat}>
                    <cylinderGeometry args={[lineRadius, lineRadius, len, 8]} />
                    <meshBasicMaterial color={color} transparent opacity={0.85} />
                  </mesh>
                  <mesh position={mid} quaternion={quat}>
                    <cylinderGeometry args={[haloRadius, haloRadius, len, 8]} />
                    <meshBasicMaterial color={color} transparent opacity={isProfile ? 0.1 : 0.08} depthWrite={false} />
                  </mesh>
                </>
              )}
              {/* 剖面面 */}
              {profilePlane}
              {/* 端点 */}
              <mesh position={p0}>
                <sphereGeometry args={[pointRadius, 12, 12]} />
                <meshBasicMaterial color={ROBOT_STATUS.online} />
              </mesh>
              <mesh position={p0}>
                <sphereGeometry args={[pointGlowRadius, 12, 12]} />
                <meshBasicMaterial color={ROBOT_STATUS.online} transparent opacity={0.12} depthWrite={false} />
              </mesh>
              <mesh position={p1}>
                <sphereGeometry args={[pointRadius, 12, 12]} />
                <meshBasicMaterial color={color} />
              </mesh>
              <mesh position={p1}>
                <sphereGeometry args={[pointGlowRadius, 12, 12]} />
                <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
              </mesh>
              <Html position={[mid.x, mid.y + (isProfile ? 2.2 : 1.4), mid.z]} center>
                <div className="glass-panel px-2 py-1 text-[10px] font-mono whitespace-nowrap flex items-center gap-2" style={{ pointerEvents: 'auto', color }}>
                  {anno.label}
                  <button
                    className="text-[#3FB950] hover:scale-110 transition-transform"
                    onClick={() => addFinding(createFindingFromAnnotation(anno))}
                    title={t('annotation.promoteFinding', locale)}
                  >
                    {t('annotation.promoteFinding', locale)}
                  </button>
                  <button className="text-[#FF3333] hover:scale-110 transition-transform ml-1" onClick={() => removeAnnotation(anno.id)} title={t('annotation.delete', locale)}>✕</button>
                </div>
              </Html>
            </group>
          );
        }

        if (anno.type === 'text' && anno.points.length >= 1) {
          const p = new THREE.Vector3(...anno.points[0]);
          return (
            <group key={anno.id}>
              <mesh position={p}>
                <sphereGeometry args={[0.16, 12, 12]} />
                <meshBasicMaterial color={INTERACTION.selected} />
              </mesh>
              <mesh position={p}>
                <sphereGeometry args={[0.3, 12, 12]} />
                <meshBasicMaterial color={INTERACTION.selected} transparent opacity={0.12} depthWrite={false} />
              </mesh>
              <Html position={[p.x, p.y + 1.3, p.z]} center>
                <div className="glass-panel px-2.5 py-1.5 text-[10px] text-[#FFE600] whitespace-nowrap flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
                  {anno.label}
                  <button
                    className="text-[#3FB950] hover:scale-110 transition-transform"
                    onClick={() => addFinding(createFindingFromAnnotation(anno))}
                    title={t('annotation.promoteFinding', locale)}
                  >
                    {t('annotation.promoteFinding', locale)}
                  </button>
                  <button className="text-[#FF3333] hover:scale-110 transition-transform ml-1" onClick={() => removeAnnotation(anno.id)} title={t('annotation.delete', locale)}>✕</button>
                </div>
              </Html>
            </group>
          );
        }

        if (anno.type === 'area' && anno.points.length >= 2) {
          const min = anno.points[0];
          const max = anno.points[1];
          const w = max[0] - min[0];
          const h = max[1] - min[1];
          const d = max[2] - min[2];
          return (
            <group key={anno.id}>
              <lineSegments position={[(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]}>
                <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
                <lineBasicMaterial color={INTERACTION.selected} transparent opacity={0.7} />
              </lineSegments>
              <mesh position={[(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]}>
                <boxGeometry args={[Math.max(0.1, w), Math.max(0.1, h), Math.max(0.1, d)]} />
                <meshBasicMaterial color={INTERACTION.selected} transparent opacity={0.03} depthWrite={false} />
              </mesh>
              <Html position={[(min[0] + max[0]) / 2, max[1] + 1.2, (min[2] + max[2]) / 2]} center>
                <div className="glass-panel px-2 py-1 text-[10px] text-[#FFE600] font-mono whitespace-nowrap flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
                  {anno.label}
                  <button
                    className="text-[#3FB950] hover:scale-110 transition-transform"
                    onClick={() => addFinding(createFindingFromAnnotation(anno))}
                    title={t('annotation.promoteFinding', locale)}
                  >
                    {t('annotation.promoteFinding', locale)}
                  </button>
                  <button className="text-[#FF3333] hover:scale-110 transition-transform ml-1" onClick={() => removeAnnotation(anno.id)} title={t('annotation.delete', locale)}>✕</button>
                </div>
              </Html>
            </group>
          );
        }

        return null;
      })}
    </group>
  );
}
