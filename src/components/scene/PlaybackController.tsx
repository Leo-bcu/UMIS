/**
 * PlaybackController — 任务回放引擎 + UI
 *
 * 模拟真实机器人探测过程：
 * 1. 按下播放 → 200个机器人在入口附近出现
 * 2. 机器人沿管道/裂缝自主寻路爬行（有的快有的慢有的卡住）
 * 3. 管道/裂缝随机器人探测逐步被"扫描出来"（散点 → 密集 → 管体成型）
 * 4. 进度到 1 → 停止播放，显示完整场景
 *
 * 引擎：useFrame 驱动进度更新
 * UI：浮动播放条（播放/暂停/重播/进度条/速度）
 */
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { resetPlaybackCache } from '../../lib/playbackEngine';

/** 在 R3F Canvas 内运行：每帧推进回放进度 */
export function PlaybackEngine() {
  const isPlaying = useSceneStore((s) => s.isPlaying);
  const playbackSpeed = useSceneStore((s) => s.playbackSpeed);
  const setPlaybackProgress = useSceneStore((s) => s.setPlaybackProgress);
  const setPlaying = useSceneStore((s) => s.setPlaying);

  useFrame((_, delta) => {
    if (!isPlaying) return;
    const progress = useSceneStore.getState().playbackProgress;
    // 基础时长：1x = 1000 秒（极慢，接近真实探测节奏）
    // 10x = 100 秒，50x = 20 秒
    const BASE_DURATION = 1000;
    const increment = (delta / BASE_DURATION) * playbackSpeed;
    const next = progress + increment;
    if (next >= 1) {
      setPlaybackProgress(1);
      setPlaying(false);
    } else {
      setPlaybackProgress(next);
    }
  });

  return null;
}

/** 浮动播放控制条 — 放在 3D 场景外部（HTML overlay） */
export function PlaybackBar() {
  const isPlaying = useSceneStore((s) => s.isPlaying);
  const progress = useSceneStore((s) => s.playbackProgress);
  const playbackActive = useSceneStore((s) => s.playbackActive);
  const speed = useSceneStore((s) => s.playbackSpeed);
  const startPlayback = useSceneStore((s) => s.startPlayback);
  const stopPlayback = useSceneStore((s) => s.stopPlayback);
  const setPlaying = useSceneStore((s) => s.setPlaying);
  const setPlaybackProgress = useSceneStore((s) => s.setPlaybackProgress);
  const setPlaybackSpeed = useSceneStore((s) => s.setPlaybackSpeed);
  const locale = useSceneStore((s) => s.locale);

  const handleStart = useCallback(() => {
    resetPlaybackCache();
    startPlayback();
  }, [startPlayback]);

  // 键盘快捷键：空格播放/暂停
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (playbackActive && progress >= 1) {
          handleStart();
        } else if (playbackActive) {
          setPlaying(!isPlaying);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleStart, isPlaying, playbackActive, progress, setPlaying]);

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0A0C14]/90 backdrop-blur-xl rounded-2xl border border-[#FFE600]/20 shadow-2xl">
        {/* 播放/暂停按钮 */}
        <button
          onClick={() => {
            if (playbackActive && progress >= 1) {
              handleStart();
            } else if (playbackActive) {
              setPlaying(!isPlaying);
            } else {
              handleStart();
            }
          }}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FFE600]/15 hover:bg-[#FFE600]/25 border border-[#FFE600]/30 transition-all group"
          title={locale === 'zh-CN' ? (isPlaying ? '暂停' : (playbackActive && progress >= 1) ? '重新播放' : '播放') : (isPlaying ? 'Pause' : (playbackActive && progress >= 1) ? 'Replay' : 'Play')}
        >
          {isPlaying ? (
            <svg className="w-4 h-4 text-[#FFE600]" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-[#FFE600] ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* 重播按钮 */}
        <button
          onClick={() => handleStart()}
          className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/10 transition-all"
          title={locale === 'zh-CN' ? '从头播放' : 'Restart'}
        >
          <svg className="w-3.5 h-3.5 text-[#A0A0B0] hover:text-[#E0E0E8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7 3.3" />
            <path d="M3 3v6h6" />
          </svg>
        </button>

        {/* 进度条 */}
        <div className="flex items-center gap-2 min-w-[240px]">
          <div className="flex-1 relative h-1.5 bg-white/8 rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              setPlaybackProgress(Math.max(0, Math.min(1, ratio)));
              setPlaying(false);
            }}
          >
            {/* 已扫描部分 */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FFE600]/60 to-[#FFE600] rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
            {/* 扫描线光点 */}
            {progress > 0 && progress < 1 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#FFE600] rounded-full shadow-[0_0_8px_#FFE600] -translate-x-1/2"
                style={{ left: `${progress * 100}%` }}
              />
            )}
          </div>
          {/* 百分比 */}
          <span className="text-[10px] font-mono text-[#A0A0B0] min-w-[36px] text-right">
            {Math.round(progress * 100)}%
          </span>
        </div>

        {/* 速度控制 */}
        <div className="flex items-center gap-1">
          {[1, 10, 20, 30, 50].map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${
                speed === s
                  ? 'bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/30'
                  : 'text-[#606070] hover:text-[#A0A0B0]'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* 完整渲染按钮 */}
        {playbackActive && (
          <button
            onClick={() => stopPlayback()}
            className="text-[9px] px-2 py-1 rounded text-[#A0A0B0] hover:text-[#E0E0E8] hover:bg-white/5 transition-all"
            title={locale === 'zh-CN' ? '退出回放，显示完整场景' : 'Exit playback and show the full scene'}
          >
            {locale === 'zh-CN' ? '完成' : 'Done'}
          </button>
        )}
      </div>
    </div>
  );
}
