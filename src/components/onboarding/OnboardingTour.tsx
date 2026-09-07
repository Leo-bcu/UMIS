import { useEffect, useState } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { t } from '../../domain/i18nCatalog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const TOUR_KEY = 'hive_onboarding_done';

interface TourStep {
  /** 目标元素选择器，定位气泡 */
  selector: string;
  titleKey: Parameters<typeof t>[0];
  bodyKey: Parameters<typeof t>[0];
  /** 气泡优先贴附方向 */
  prefer?: 'bottom' | 'top' | 'center' | 'left';
}

const STEPS: TourStep[] = [
  { selector: '[data-tour="scenario-selector"]', titleKey: 'tour.step1.title', bodyKey: 'tour.step1.body', prefer: 'bottom' },
  { selector: '[data-tour="scene-3d"]', titleKey: 'tour.step2.title', bodyKey: 'tour.step2.body', prefer: 'center' },
  { selector: '[data-tour="detail-panel"]', titleKey: 'tour.step3.title', bodyKey: 'tour.step3.body', prefer: 'left' },
  { selector: '[data-tour="ai-export"]', titleKey: 'tour.step4.title', bodyKey: 'tour.step4.body', prefer: 'top' },
];

interface Rect { top: number; left: number; width: number; height: number; }

function getTargetRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  // 过滤不可见元素
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function OnboardingTour() {
  const isTestHooks = import.meta.env.MODE === 'development' || import.meta.env.VITE_TEST_HOOKS === '1';
  const active = useSceneStore((s) => s.onboardingActive);
  const stopOnboarding = useSceneStore((s) => s.stopOnboarding);
  const locale = useSceneStore((s) => s.locale);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // 首次访问自动启动（仅一次）
  useEffect(() => {
    if (isTestHooks) return;
    if (localStorage.getItem(TOUR_KEY)) return;
    const id = setTimeout(() => useSceneStore.getState().startOnboarding(), 1200);
    return () => clearTimeout(id);
  }, [isTestHooks]);

  // 跟踪当前步骤的目标位置
  useEffect(() => {
    if (isTestHooks) return;
    if (!active) return;
    const update = () => {
      const current = STEPS[step];
      setRect(current ? getTargetRect(current.selector) : null);
    };
    update();
    window.addEventListener('resize', update);
    const id = setInterval(update, 400); // 目标元素可能延迟渲染
    return () => {
      window.removeEventListener('resize', update);
      clearInterval(id);
    };
  }, [active, step, isTestHooks]);

  if (isTestHooks) return null;
  if (!active) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleFinish = () => {
    localStorage.setItem(TOUR_KEY, '1');
    stopOnboarding();
  };
  const handleSkip = () => {
    localStorage.setItem(TOUR_KEY, '1');
    stopOnboarding();
  };

  // spotlight 蒙层：4 层 box-shadow 挖洞，或全屏蒙层（目标找不到时）
  const PAD = 8;
  const hole = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // 气泡定位
  let bubbleStyle: React.CSSProperties = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  if (hole) {
    const spacing = 16;
    if (current.prefer === 'bottom') {
      bubbleStyle = { top: hole.top + hole.height + spacing, left: Math.max(12, Math.min(hole.left, window.innerWidth - 320)) };
    } else if (current.prefer === 'top') {
      bubbleStyle = { top: Math.max(12, hole.top - 180), left: Math.max(12, Math.min(hole.left, window.innerWidth - 320)) };
    } else if (current.prefer === 'left') {
      bubbleStyle = { top: hole.top, left: Math.max(12, hole.left - 340) };
    } else {
      // center: 贴在目标下方
      bubbleStyle = { top: hole.top + hole.height + spacing, left: Math.max(12, Math.min(hole.left, window.innerWidth - 320)) };
    }
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Spotlight 蒙层 */}
      {hole ? (
        <div
          className="absolute inset-0"
          style={{
            boxShadow: `0 0 0 9999px rgba(8, 8, 18, 0.72)`,
            borderRadius: 10,
            border: '2px solid rgba(201, 154, 46, 0.7)',
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            position: 'absolute',
            transition: 'all 0.3s ease',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#080812]/72" />
      )}

      {/* 气泡 */}
      <div
        data-testid="onboarding-bubble"
        className="absolute w-[300px] rounded-lg border border-[#C99A2E]/40 bg-white p-3 shadow-xl"
        style={bubbleStyle}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#C99A2E]">
            {locale === 'zh-CN' ? `步骤 ${step + 1} / ${STEPS.length}` : `Step ${step + 1} / ${STEPS.length}`}
          </span>
          <button onClick={handleSkip} className="text-[#667085] hover:text-[#182230]" aria-label={t('tour.skip', locale)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <h3 className="mb-1 text-sm font-bold text-[#182230]">{t(current.titleKey, locale)}</h3>
        <p className="mb-3 text-[11px] leading-relaxed text-[#667085]">{t(current.bodyKey, locale)}</p>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-0.5 text-[10px] text-[#667085] hover:text-[#182230] disabled:opacity-30"
          >
            <ChevronLeft className="h-3 w-3" />
            {t('tour.prev', locale)}
          </button>
          {isLast ? (
            <button
              onClick={handleFinish}
              className="rounded bg-[#C99A2E] px-3 py-1 text-[10px] font-semibold text-white hover:bg-[#B0852A]"
            >
              {t('tour.done', locale)}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="flex items-center gap-0.5 rounded bg-[#C99A2E] px-3 py-1 text-[10px] font-semibold text-white hover:bg-[#B0852A]"
            >
              {t('tour.next', locale)}
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
        {/* 进度点 */}
        <div className="mt-2 flex justify-center gap-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-4 rounded-full transition-colors ${i === step ? 'bg-[#C99A2E]' : 'bg-[#D9E1EA]'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
