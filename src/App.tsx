import { MainLayout } from './components/layout/MainLayout';
import { ControlPanel } from './components/control-panel/ControlPanel';
import { Scene3DCanvas } from './components/scene/Scene3DCanvas';
import { ChatPanel } from './components/chat/ChatPanel';
import { WatermarkOverlay } from './components/scene/WatermarkOverlay';
import { OnboardingTour } from './components/onboarding/OnboardingTour';
import { useSceneStore } from './store/useSceneStore';
import { t } from './domain/i18nCatalog';
import { getSceneSemantics } from './lib/sceneSemantics';
import type { ScenarioType } from './types';
import { useEffect } from 'react';

interface DevProjectionPoint {
  x: number;
  y: number;
  visible: boolean;
}

interface DevInteractiveTarget {
  id: string;
  label: string;
  type: 'robot' | 'fracture-node' | 'fracture-path';
  point: [number, number, number];
  screen: DevProjectionPoint;
}

function normalizeDevScenario(scenario: string | null): ScenarioType | null {
  if (!scenario) return null;
  if (scenario === 'fracture') return 'coal';

  const validScenarios: ScenarioType[] = ['coal', 'gold', 'oil', 'pipeline', 'nuclear', 'refinery', 'underground'];
  return validScenarios.includes(scenario as ScenarioType) ? scenario as ScenarioType : null;
}

function installDevTestApi() {
  const win = window as Window & {
    __HIVE_STORE__?: typeof useSceneStore;
    __HIVE_DEV_VIEW__?: {
      projectPoint: (point: [number, number, number]) => DevProjectionPoint;
    };
    __HIVE_TEST_API__?: {
      setLocale: (locale: 'zh-CN' | 'en-US') => void;
      switchScenario: (scenario: ScenarioType) => void;
      selectRobotById: (id: string) => Promise<boolean>;
      selectFractureById: (id: string) => Promise<boolean>;
      setActiveTool: (tool: 'none' | 'profile' | 'area' | 'text' | 'distance') => void;
      getSnapshot: () => ReturnType<typeof useSceneStore.getState>;
      getInteractiveTargets: () => Promise<{
        robots: DevInteractiveTarget[];
        fractureNodes: DevInteractiveTarget[];
        fracturePaths: DevInteractiveTarget[];
      }>;
      getOverlappingTargets: () => Promise<{
        robot: DevInteractiveTarget;
        spatial: DevInteractiveTarget;
        screen: DevProjectionPoint;
        distance: number;
      } | null>;
    };
  };
  win.__HIVE_STORE__ = useSceneStore;
  win.__HIVE_TEST_API__ = {
    setLocale: (locale) => {
      useSceneStore.getState().setLocale(locale);
    },
    switchScenario: (scenario) => {
      const state = useSceneStore.getState();
      state.setDataSource(
        scenario === 'pipeline'
          ? 'pipeline'
          : scenario === 'nuclear'
            ? 'nuclear'
            : scenario === 'refinery'
              ? 'refinery'
              : scenario === 'underground'
                ? 'underground'
                : 'fracture',
      );
      state.setScenario(scenario);
      state.setGasThreshold(getSceneSemantics(scenario).threshold.defaultValue);
    },
    selectRobotById: async (id) => {
      const { buildSceneDataset } = await import('./domain/sceneDataset');
      const state = useSceneStore.getState();
      const robot = buildSceneDataset(state.dataSource, state.scenario).robots.find((item) => item.id === id);
      if (!robot) return false;
      state.openRobotDetail(robot);
      return true;
    },
    selectFractureById: async (id) => {
      const { buildSceneDataset } = await import('./domain/sceneDataset');
      const state = useSceneStore.getState();
      const fracture = buildSceneDataset(state.dataSource, state.scenario).fractures.find((item) => item.id === id);
      if (!fracture) return false;
      state.selectFracture(fracture);
      return true;
    },
    setActiveTool: (tool) => {
      useSceneStore.getState().setActiveTool(tool);
    },
    getSnapshot: () => useSceneStore.getState(),
    getInteractiveTargets: async () => {
      const { buildSceneDataset } = await import('./domain/sceneDataset');
      const state = useSceneStore.getState();
      const view = win.__HIVE_DEV_VIEW__;
      const dataset = buildSceneDataset(state.dataSource, state.scenario);
      const beacon = document.querySelector('[data-testid="dev-interactions"]');

      const parseBeaconTargets = (value: string | undefined, type: DevInteractiveTarget['type']) => {
        if (!value) return [];
        try {
          const items = JSON.parse(value) as Omit<DevInteractiveTarget, 'type'>[];
          return items.map((item) => ({ ...item, type }));
        } catch {
          return [];
        }
      };

      if (beacon instanceof HTMLElement) {
        const robots = parseBeaconTargets(beacon.dataset.robots, 'robot');
        const fractureNodes = parseBeaconTargets(beacon.dataset.fractureNodes, 'fracture-node');
        const fracturePaths = parseBeaconTargets(beacon.dataset.fracturePaths, 'fracture-path');
        if (robots.length || fractureNodes.length || fracturePaths.length) {
          return { robots, fractureNodes, fracturePaths };
        }
      }

      const robots = dataset.robots
        .map((robot) => ({
          id: robot.id,
          label: robot.task,
          type: 'robot' as const,
          point: robot.position,
          screen: view?.projectPoint(robot.position) ?? { x: 0, y: 0, visible: false },
        }))
        .filter((target) => target.screen.visible);

      const fractureNodes = dataset.fractures.flatMap((fracture) =>
        fracture.nodes.map((node) => ({
          id: node.id,
          label: `${fracture.name}:${node.id}`,
          type: 'fracture-node' as const,
          point: node.position,
          screen: view?.projectPoint(node.position) ?? { x: 0, y: 0, visible: false },
        }))
      ).filter((target) => target.screen.visible);

      const fracturePaths = dataset.fractures.flatMap((fracture) =>
        fracture.path
          .filter((_, index) => index % 2 === 0)
          .map((point, index) => ({
            id: `${fracture.id}-path-${index}`,
            label: fracture.name,
            type: 'fracture-path' as const,
            point,
            screen: view?.projectPoint(point) ?? { x: 0, y: 0, visible: false },
          }))
      ).filter((target) => target.screen.visible);

      return { robots, fractureNodes, fracturePaths };
    },
    getOverlappingTargets: async () => {
      const targets = await win.__HIVE_TEST_API__?.getInteractiveTargets();
      if (!targets) return null;
      const spatialTargets = [...targets.fractureNodes, ...targets.fracturePaths];
      let best: {
        robot: DevInteractiveTarget;
        spatial: DevInteractiveTarget;
        screen: DevProjectionPoint;
        distance: number;
      } | null = null;

      for (const robot of targets.robots) {
        for (const spatial of spatialTargets) {
          const distance = Math.hypot(robot.screen.x - spatial.screen.x, robot.screen.y - spatial.screen.y);
          if (distance > 44) continue;
          if (!best || distance < best.distance) {
            best = {
              robot,
              spatial,
              screen: {
                x: (robot.screen.x + spatial.screen.x) / 2,
                y: (robot.screen.y + spatial.screen.y) / 2,
                visible: robot.screen.visible && spatial.screen.visible,
              },
              distance,
            };
          }
        }
      }

      return best;
    },
  };
}

/** C4: 小屏幕提示 — 宽度不足时引导用户使用桌面端 */
function MobileWarning() {
  const locale = useSceneStore((s) => s.locale);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#080812] flex flex-col items-center justify-center p-8 text-center md:hidden">
      <div className="text-5xl mb-4">🖥️</div>
      <h1 className="text-lg font-bold text-[#FFE600] mb-3">{t('mobile.title', locale)}</h1>
      <p className="text-sm text-[#A0A0B0] leading-relaxed max-w-xs">
        {t('mobile.body', locale)}
        <br /><br />
        {locale === 'zh-CN'
          ? '请在宽度 ≥ 768px 的设备上访问（推荐 1920×1080 及以上分辨率）。'
          : 'Use a viewport wider than 768px. 1920×1080 or above is recommended.'}
      </p>
    </div>
  );
}

function DevStateBeacon() {
  const locale = useSceneStore((s) => s.locale);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const activeTool = useSceneStore((s) => s.activeTool);
  const selectedRobotId = useSceneStore((s) => s.selectedRobot?.id ?? '');
  const selectedFractureId = useSceneStore((s) => s.selectedFracture?.id ?? '');
  const selectedFractureNodeId = useSceneStore((s) => s.selectedFractureNode ?? '');

  return (
    <div
      data-testid="dev-state"
      data-locale={locale}
      data-data-source={dataSource}
      data-scenario={scenario}
      data-active-tool={activeTool}
      data-selected-robot={selectedRobotId}
      data-selected-fracture={selectedFractureId}
      data-selected-node={selectedFractureNodeId}
      hidden
      aria-hidden="true"
    />
  );
}

function DevInteractionBeacon() {
  return (
    <div
      data-testid="dev-interactions"
      data-robots="[]"
      data-fracture-nodes="[]"
      data-fracture-paths="[]"
      hidden
      aria-hidden="true"
    />
  );
}

function DevSelectionDebugBeacon() {
  return (
    <div
      data-testid="dev-selection-debug"
      data-last-down=""
      data-last-up=""
      data-last-delta=""
      data-last-nearest-robot=""
      data-last-screen-fracture=""
      data-last-snap-target=""
      data-last-selection=""
      hidden
      aria-hidden="true"
    />
  );
}

function DevUrlBootstrap() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locale = params.get('dev-locale');
    const scenario = normalizeDevScenario(params.get('dev-scenario'));
    const tool = params.get('dev-tool') as 'none' | 'profile' | 'area' | 'text' | 'distance' | null;
    const robotId = params.get('dev-robot');
    const fractureId = params.get('dev-fracture');

    const api = (window as Window & {
      __HIVE_TEST_API__?: {
        setLocale: (locale: 'zh-CN' | 'en-US') => void;
        switchScenario: (scenario: ScenarioType) => void;
        selectRobotById: (id: string) => Promise<boolean>;
        selectFractureById: (id: string) => Promise<boolean>;
        setActiveTool: (tool: 'none' | 'profile' | 'area' | 'text' | 'distance') => void;
      };
    }).__HIVE_TEST_API__;

    if (!api) return;

    if (locale === 'zh-CN' || locale === 'en-US') {
      api.setLocale(locale);
    }
    if (scenario) {
      api.switchScenario(scenario);
    }
    if (tool) {
      api.setActiveTool(tool);
    }

    void (async () => {
      if (robotId) {
        await api.selectRobotById(robotId);
      }
      if (fractureId) {
        await api.selectFractureById(fractureId);
      }
    })();
  }, []);

  return null;
}

// 测试钩子开关：Vite 的 import.meta.env.DEV 在部分沙箱/CI 环境下会被误判为 false，
// 导致 ui-regression 等测试脚本无法运行。改用 MODE 判定 + 显式 env 强制开关，更可靠。
const TEST_HOOKS =
  import.meta.env.MODE === 'development' || import.meta.env.VITE_TEST_HOOKS === '1';

export default function App() {
  if (TEST_HOOKS) {
    installDevTestApi();
  }

  return (
    <>
      <MobileWarning />
      {TEST_HOOKS && <DevUrlBootstrap />}
      {TEST_HOOKS && <DevStateBeacon />}
      {TEST_HOOKS && <DevInteractionBeacon />}
      {TEST_HOOKS && <DevSelectionDebugBeacon />}
      <MainLayout
        controlPanel={<ControlPanel />}
        scene3D={<Scene3DCanvas />}
        chatPanel={<ChatPanel />}
        watermark={<WatermarkOverlay />}
      />
      <OnboardingTour />
    </>
  );
}
