import { useThree, useFrame } from '@react-three/fiber';
import { useSceneStore } from '../../store/useSceneStore';

/**
 * Pure HTML overlay (outside Canvas) that reads camera position from store.
 */
export function CameraInfo() {
  const cam = useSceneStore((s) => s.cameraInfo);

  return (
    <div
      className="glass-panel px-3 py-2 text-[10px] font-mono text-text-muted pointer-events-none"
      style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 40 }}
    >
      <div className="text-primary-yellow text-[9px] mb-1 tracking-wider">CAMERA</div>
      <div>X: <span className="text-text">{cam.x.toFixed(1)}</span></div>
      <div>Y: <span className="text-text">{cam.y.toFixed(1)}</span></div>
      <div>Z: <span className="text-text">{cam.z.toFixed(1)}</span></div>
      <div className="mt-1 pt-1 border-t border-white/10">
        ZOOM: <span className="text-primary-yellow">{(100 / Math.max(1, cam.dist) * 30).toFixed(0)}%</span>
      </div>
    </div>
  );
}

/**
 * Inside-Canvas component that pushes camera position into store every ~100ms.
 */
export function CameraTracker() {
  const setCameraInfo = useSceneStore((s) => s.setCameraInfo);
  const { camera } = useThree();
  let lastUpdate = 0;

  useFrame(() => {
    const now = performance.now();
    if (now - lastUpdate > 100) {
      lastUpdate = now;
      setCameraInfo({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        dist: camera.position.length(),
      });
    }
  });

  return null;
}
