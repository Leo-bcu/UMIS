import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '../../store/useSceneStore';

/**
 * 场景切换进度条 — 监听 scenario/dataSource 变化，在顶部显示一条渐变进度条。
 * 纯 CSS 动画，零依赖。给用户"正在切换"的即时反馈，避免干等。
 */
export function SceneSwitchProgress() {
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActive(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scenario, dataSource]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[9998] h-[2px] overflow-hidden">
      <div
        className="h-full"
        style={{
          background: 'linear-gradient(90deg, #C99A2E 0%, #FFE600 50%, #C99A2E 100%)',
          animation: 'hive-scene-progress 0.9s ease-out forwards',
          boxShadow: '0 0 8px rgba(201,154,46,0.6)',
        }}
      />
      <style>{`
        @keyframes hive-scene-progress {
          0% { width: 0%; opacity: 1; }
          60% { width: 75%; opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
