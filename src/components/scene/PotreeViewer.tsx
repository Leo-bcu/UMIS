/**
 * PotreeViewer — 工业级点云渲染集成
 *
 * 使用 Potree (potree.org) 八叉树 LOD 引擎渲染大规模点云。
 * Potree 在独立的 WebGL context 中运行，通过相机同步与 R3F 场景融合。
 *
 * 架构：
 *   R3F Canvas (z-10, pointer events) → Potree Canvas (z-0, 背景层)
 *   相机流向：R3F OrbitControls → useFrame → Potree scene.view
 *
 * 数据来源：
 *   - live 模式：后端 PotreeConverter 转换的真实点云八叉树
 *   - mock 模式：不加载无关示例点云，避免把外部 demo 当作 HIVE 证据
 */

import { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import type { PotreeTweenInstance, PotreeViewerInstance } from '../../types/potree';

/**
 * PotreeCameraSync — 在 R3F Canvas 内运行，每帧将 R3F 相机同步到 Potree 相机
 * 必须放在 <Canvas> 内部使用
 */
export function PotreeCameraSync() {
  const { camera } = useThree();

  useFrame(() => {
    if (!potreeViewer) return;

    const view = potreeViewer.scene.view;
    if (!view) return;

    // 同步相机位置
    view.position.copy(camera.position);

    // 同步朝向：计算 R3F 相机的 lookAt 目标
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const target = camera.position.clone().add(dir.multiplyScalar(50));
    view.lookAt(target);

    // 触发 Potree 重渲染（部分构建不暴露 setDirty，需兼容）
    if (typeof potreeViewer.setDirty === 'function') {
      potreeViewer.setDirty();
    }
  });

  return null;
}

// 模块级共享：Potree viewer 实例（供 PotreeCameraSync 读取）
export let potreeViewer: PotreeViewerInstance | null = null;

// 动态加载脚本（顺序：jQuery → Potree CSS → Potree JS）
let potreeScriptPromise: Promise<void> | null = null;

function ensureTweenCompat() {
  if (window.TWEEN) return;

  const tweens = new Set<CompatTween>();
  const linear = (k: number) => k;
  const quarticOut = (k: number) => 1 - Math.pow(1 - k, 4);

  class CompatTween implements PotreeTweenInstance {
    private from: Record<string, number> = {};
    private toValues: Record<string, number> = {};
    private duration = 0;
    private startTime = 0;
    private easingFn = linear;
    private updateFn: () => void = () => {};
    private completeFn: () => void = () => {};

    constructor(private target: Record<string, number> | THREE.Vector3) {}

    to(target: Record<string, number> | THREE.Vector3, duration = 0) {
      this.toValues = {};
      for (const [key, value] of Object.entries(target)) {
        if (typeof value === 'number') this.toValues[key] = value;
      }
      this.duration = Math.max(0, duration);
      return this;
    }

    easing(fn: (k: number) => number) {
      this.easingFn = fn;
      return this;
    }

    onUpdate(fn: () => void) {
      this.updateFn = fn;
      return this;
    }

    onComplete(fn: () => void) {
      this.completeFn = fn;
      return this;
    }

    start(time = performance.now()) {
      this.startTime = time;
      this.from = {};
      for (const key of Object.keys(this.toValues)) {
        const value = (this.target as unknown as Record<string, number>)[key];
        this.from[key] = typeof value === 'number' ? value : 0;
      }
      tweens.add(this);
      return this;
    }

    stop() {
      tweens.delete(this);
      return this;
    }

    tick(time = performance.now()) {
      const elapsed = this.duration <= 0 ? 1 : Math.min(1, (time - this.startTime) / this.duration);
      const eased = this.easingFn(elapsed);
      const target = this.target as unknown as Record<string, number>;
      for (const [key, to] of Object.entries(this.toValues)) {
        const from = this.from[key] ?? 0;
        target[key] = from + (to - from) * eased;
      }
      this.updateFn();
      if (elapsed >= 1) {
        tweens.delete(this);
        this.completeFn();
      }
    }
  }

  window.TWEEN = {
    Tween: CompatTween,
    Easing: {
      Linear: { None: linear },
      Quartic: { Out: quarticOut },
    },
    update: (time?: number) => {
      for (const tween of Array.from(tweens)) tween.tick(time);
      return tweens.size > 0;
    },
    remove: (tween: PotreeTweenInstance) => {
      tweens.delete(tween as CompatTween);
    },
  };
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

function loadPotreeScript(): Promise<void> {
  if (potreeScriptPromise) return potreeScriptPromise;
  potreeScriptPromise = (async () => {
    const base = import.meta.env.BASE_URL;

    // 1. jQuery（Potree 1.8 依赖）
    if (!window.jQuery) {
      await loadScript(`${base}potree/jquery.min.js`);
    }

    ensureTweenCompat();

    // 1.5 BinaryHeap — Potree 1.8 内部依赖但未在 potree.js 中定义
    if (!window.BinaryHeap) {
      window.BinaryHeap = class BinaryHeap<T> {
        private content: T[] = [];
        private scoreFunction: (x: T) => number;
        constructor(scoreFunction: (x: T) => number) {
          this.scoreFunction = scoreFunction;
        }
        push(element: T) {
          this.content.push(element);
          this.bubbleUp(this.content.length - 1);
        }
        pop(): T {
          const result = this.content[0];
          const end = this.content.pop()!;
          if (this.content.length > 0) {
            this.content[0] = end;
            this.sinkDown(0);
          }
          return result;
        }
        remove(node: T) {
          const length = this.content.length;
          for (let i = 0; i < length; i++) {
            if (this.content[i] !== node) continue;
            const end = this.content.pop()!;
            if (i !== length - 1) {
              this.content[i] = end;
              this.bubbleUp(i);
              this.sinkDown(i);
            }
            return;
          }
        }
        size(): number { return this.content.length; }
        bubbleUp(n: number) {
          const element = this.content[n];
          const score = this.scoreFunction(element);
          while (n > 0) {
            const parentN = Math.floor((n + 1) / 2) - 1;
            const parent = this.content[parentN];
            if (score >= this.scoreFunction(parent)) break;
            this.content[parentN] = element;
            this.content[n] = parent;
            n = parentN;
          }
        }
        sinkDown(n: number) {
          const length = this.content.length;
          const element = this.content[n];
          const elemScore = this.scoreFunction(element);
          for (;;) {
            const child2N = (n + 1) * 2;
            const child1N = child2N - 1;
            let swap = -1;
            let child1Score: number | undefined;
            if (child1N < length) {
              const child1 = this.content[child1N];
              child1Score = this.scoreFunction(child1);
              if (child1Score < elemScore) swap = child1N;
            }
            if (child2N < length) {
              const child2 = this.content[child2N];
              const child2Score = this.scoreFunction(child2);
              if (child2Score < (swap === -1 ? elemScore : child1Score!)) swap = child2N;
            }
            if (swap === -1) break;
            this.content[n] = this.content[swap];
            this.content[swap] = element;
            n = swap;
          }
        }
      };
    }

    // 2. proj4（Potree 坐标投影依赖，缺失会导致 "proj4 is not defined"）
    if (!window.proj4) {
      await loadScript(`${base}potree/proj4.js`);
    }

    // 3. Potree CSS
    if (!document.querySelector('link[href*="potree.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${base}potree/potree.css`;
      document.head.appendChild(link);
    }

    // 4. Potree JS
    if (!window.Potree?.Viewer) {
      await loadScript(`${base}potree/potree.js`);
      // 验证 Potree 正确导出
      if (!window.Potree?.Viewer) {
        throw new Error('Potree 加载失败 — Viewer 未导出（jQuery 可能未正确加载）');
      }
    }
  })();
  return potreeScriptPromise;
}

// API 配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_MODE = import.meta.env.VITE_API_MODE || 'mock';

// 点云数据 URL
function getPointCloudUrl(): string | null {
  if (API_MODE === 'live' && API_BASE_URL) {
    return `${API_BASE_URL}/potree/metadata.json`;
  }
  return null;
}

export function PotreeViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const visible = useSceneStore((s) => s.layers.pointCloud);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    let viewer: PotreeViewerInstance | null = null;
    const container = containerRef.current;

    // 超时保护：10 秒后自动隐藏 loading（Potree 是增强层，不应阻塞 UI）
    const loadTimeout = setTimeout(() => setLoading(false), 10_000);

    loadPotreeScript()
      .then(() => {
        if (cancelled || !container) return;

        const Potree = window.Potree;
        if (!Potree) throw new Error('Potree 未加载');
        viewer = new Potree.Viewer(container);

        // 隐藏 Potree 自带 UI（我们用自己的 React UI）
        viewer.setEDLEnabled(true);
        viewer.setEDLOpacity(0.8);
        viewer.setEDLRadius(1.4);
        viewer.setEDLStrength(0.4);
        viewer.setBackground(null); // 透明背景
        viewer.setPointBudget(1_000_000); // 100万点预算
        viewer.setFOV(50);
        viewer.setClipTask(Potree.ClipTask.SHOW_INSIDE);

        // 隐藏 Potree 的 UI 面板和工具栏
        try { viewer.setNavigationMode(Potree.OrbitControls); } catch { /* 部分 Potree 构建无此方法 */ }
        if (viewer.toggleSidebar) viewer.toggleSidebar();
        if (viewer.setTools) viewer.setTools([]);

        // 禁用 Potree 的自带输入处理（R3F 统一控制相机）
        if (typeof viewer.inputHandler?.setEnabled === 'function') {
          viewer.inputHandler.setEnabled(false);
        } else if (viewer.inputHandler) {
          viewer.inputHandler.enabled = false;
        }

        potreeViewer = viewer;

        // 加载点云
        const pcUrl = getPointCloudUrl();
        if (!pcUrl) {
          setLoading(false);
          return;
        }
        Potree.loadPointCloud(pcUrl, 'pointcloud', (e) => {
          if (cancelled) return;

          if (e.type === 'loading_failed') {
            console.error('[PotreeViewer] Point cloud loading failed');
            setLoading(false);
            return;
          }

          if (!viewer) return;
          const scene = viewer.scene;
          scene.addPointCloud(e.pointcloud);

          // 设置初始材质
          const material = e.pointcloud.material;
          material.size = 1.5;
          material.pointSizeType = Potree.PointSizeType.ADAPTIVE;
          material.shape = Potree.PointShape.CIRCLE;
          material.activeAttributeName = 'rgba'; // 使用原始颜色

          // 自动适应视角
          viewer.fitToScreen();

          setLoading(false);
        });
      })
      .catch((err) => {
        console.error('[PotreeViewer] Failed to init Potree:', err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(loadTimeout);
      potreeViewer = null;
      if (viewer && container) {
        try {
          viewer.onBeforeRender = null;
          container.innerHTML = '';
        } catch {
          // ignore
        }
      }
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: 'transparent' }}
      />
      {loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-5 pointer-events-none">
          <div className="text-[10px] text-[#A0A0B0] bg-[#0A0C14]/80 px-3 py-1.5 rounded border border-white/10 animate-pulse">
            Potree 点云加载中...
          </div>
        </div>
      )}
      {/* Potree 加载失败时静默降级，不向用户显示错误 */}
    </>
  );
}
