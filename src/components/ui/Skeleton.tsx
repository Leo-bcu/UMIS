import type { ReactNode } from 'react';

/**
 * 骨架屏原子 — 替代"加载中..."文字，用 shimmer 动画给加载态更专业的视觉反馈。
 * 纯 CSS，零依赖。
 */
export function Skeleton({ className = '', width, height }: { className?: string; width?: string; height?: string }) {
  return (
    <div
      className={`rounded bg-[#E9EEF3] ${className}`}
      style={{
        width,
        height,
        background: 'linear-gradient(90deg, #E9EEF3 25%, #F4F7FA 50%, #E9EEF3 75%)',
        backgroundSize: '200% 100%',
        animation: 'hive-skeleton-shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

/** 面板骨架 — 模拟一个卡片面板的加载态 */
export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-2">
      <Skeleton width="40%" height="10px" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width={i === rows - 1 ? '60%' : '100%'} height="14px" />
      ))}
    </div>
  );
}

/** 指标骨架 — 模拟统计数字的加载态 */
export function MetricSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton width="50px" height="8px" />
      <Skeleton width="34px" height="18px" />
    </div>
  );
}

/** 条件渲染：loading 时显示骨架，否则渲染 children */
export function AsyncBoundary({ loading, skeleton, children }: { loading: boolean; skeleton: ReactNode; children: ReactNode }) {
  return loading ? <>{skeleton}</> : <>{children}</>;
}
