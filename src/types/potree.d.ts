/** Potree 全局类型声明 */

declare global {
  interface Window {
    Potree?: PotreeNamespace;
    jQuery?: unknown;
    proj4?: unknown;
    BinaryHeap?: typeof BinaryHeap;
    TWEEN?: PotreeTweenNamespace;
  }
}

export interface PotreeTweenNamespace {
  Tween: new (target: Record<string, number> | THREE.Vector3) => PotreeTweenInstance;
  Easing: {
    Linear: { None: (k: number) => number };
    Quartic: { Out: (k: number) => number };
  };
  update: (time?: number) => boolean;
  remove: (tween: PotreeTweenInstance) => void;
}

export interface PotreeTweenInstance {
  to: (target: Record<string, number> | THREE.Vector3, duration?: number) => PotreeTweenInstance;
  easing: (fn: (k: number) => number) => PotreeTweenInstance;
  onUpdate: (fn: () => void) => PotreeTweenInstance;
  onComplete: (fn: () => void) => PotreeTweenInstance;
  start: (time?: number) => PotreeTweenInstance;
  stop: () => PotreeTweenInstance;
}

/** Potree 命名空间（部分类型，按需扩展） */
export interface PotreeNamespace {
  Viewer: new (container: HTMLElement) => PotreeViewerInstance;
  loadPointCloud: (
    url: string,
    name: string,
    callback: (e: PotreeLoadEvent) => void
  ) => void;
  ClipTask: { SHOW_INSIDE: number; SHOW_OUTSIDE: number; HIGHLIGHT_INSIDE: number };
  PointSizeType: { ADAPTIVE: number; FIXED: number };
  PointShape: { CIRCLE: number; SQUARE: number };
  OrbitControls: unknown;
}

export interface PotreeViewerInstance {
  scene: {
    pointclouds: PotreePointCloud[];
    view: PotreeView;
    addPointCloud: (pc: PotreePointCloud) => void;
    removeAllPointClouds: () => void;
  };
  inputHandler?: { setEnabled?: (enabled: boolean) => void; enabled?: boolean };
  setEDLEnabled: (enabled: boolean) => void;
  setEDLOpacity: (opacity: number) => void;
  setEDLRadius: (radius: number) => void;
  setEDLStrength: (strength: number) => void;
  setBackground: (color: string | null) => void;
  setPointBudget: (budget: number) => void;
  setFOV: (fov: number) => void;
  setClipTask: (task: number) => void;
  setNavigationMode: (mode: unknown) => void;
  setDirty: () => void;
  fitToScreen: () => void;
  toggleSidebar?: () => void;
  setTools?: (tools: unknown[]) => void;
  onBeforeRender: (() => void) | null;
}

export interface PotreeView {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  radius: number;
  lookAt: (point: THREE.Vector3) => void;
}

export interface PotreeLoadEvent {
  type: string;
  pointcloud: PotreePointCloud;
}

export interface PotreePointCloud {
  pcoGeometry: { numPoints: number };
  material: {
    size: number;
    pointSizeType: number;
    shape: number;
    activeAttributeName: string;
  };
}

export {};
