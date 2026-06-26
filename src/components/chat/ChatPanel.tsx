import { useRef, useEffect, useState, useMemo } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickCommands } from './QuickCommands';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Bot, ChevronRight } from 'lucide-react';
import type { AIMarker, ChatMessage as ChatMessageType, SceneAction } from '../../types';
import type { CoreMessage } from '../../types/api';
import { streamChat } from '../../api/aiApi';
import { loadSettings } from '../../lib/llmSettings';
import { createFindingFromAIMarker } from '../../domain/findingFactory';
import { fetchFractures } from '../../api/fractureApi';
import { createAIActionAuditEntry } from '../../domain/aiActionPolicy';
import { t, tf } from '../../domain/i18nCatalog';

export function ChatPanel() {
  const messages = useSceneStore((s) => s.messages);
  const collapsed = useSceneStore((s) => s.chatCollapsed);
  const toggleCollapsed = useSceneStore((s) => s.toggleChatCollapsed);
  const scenario = useSceneStore((s) => s.scenario);
  const locale = useSceneStore((s) => s.locale);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const isSending = streamingText !== null;

  // 动态AI助手名称 — 随场景切换
  const aiTitle = useMemo(() => {
    if (locale === 'en-US') {
      if (scenario === 'coal') return 'Coal Mine Gas Inspection AI';
      if (scenario === 'pipeline') return 'Pipeline Inspection AI';
      if (scenario === 'nuclear') return 'Reactor Maintenance AI';
      if (scenario === 'refinery') return 'Chemical Confined-Space AI';
      if (scenario === 'gold') return 'Gold Mine Safety AI';
      if (scenario === 'oil') return 'Reservoir Analysis AI';
      if (scenario === 'underground') return 'Underground Flow Detection AI';
      return 'Inspection AI';
    }
    if (scenario === 'coal') return '煤矿瓦斯巡检AI助手';
    if (scenario === 'pipeline') return '管线巡检AI助手';
    if (scenario === 'nuclear') return '核反应堆检修AI助手';
    if (scenario === 'refinery') return '化工密闭空间AI助手';
    if (scenario === 'gold') return '金矿安全AI助手';
    if (scenario === 'oil') return '油气储层AI助手';
    if (scenario === 'underground') return '地下暗流探测AI助手';
    return '巡检AI助手';
  }, [locale, scenario]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleSend = async (text: string) => {
    if (isSending) return;

    // 1. 添加用户消息
    const userMsg: ChatMessageType = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    useSceneStore.setState((state) => ({ messages: [...state.messages, userMsg] }));

    // 2. 通过 API 层流式获取 AI 响应（含场景上下文 + Function Calling）
    const coreMessages: CoreMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content } as CoreMessage)),
      { role: 'user', content: text },
    ];

    let streamed = '';
    setStreamingText('');

    try {
      const state = useSceneStore.getState();
      const response = await streamChat(
        coreMessages,
        (delta) => {
          streamed += delta;
          setStreamingText(streamed);
        },
        undefined,
        {
          fractures: state.fractures,
          scenario: state.scenario,
          gasThreshold: state.gasThreshold,
        }
      );

      // 3. 添加完整 AI 消息
      const aiMsg: ChatMessageType = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
        action: response.action,
        actions: response.actions,
      };
      useSceneStore.setState((state) => ({ messages: [...state.messages, aiMsg] }));
      setStreamingText(null);

      // 4. 执行空间联动（言出法随）
      const allActions = response.actions || (response.action ? [response.action] : []);
      for (const action of allActions) {
        executeActions(action);
      }
    } catch (err) {
      // C2: 错误恢复 — 显示错误消息并允许重试
      setStreamingText(null);
      const reason = (err as Error)?.message || (locale === 'zh-CN' ? '网络错误或 API Key 无效' : 'Network error or invalid API key');
      const errMsg: ChatMessageType = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `## ${t('chat.requestFailedTitle', locale)}\n\n${tf('chat.requestFailedBody', locale, { reason })}`,
        timestamp: Date.now(),
      };
      useSceneStore.setState((state) => ({ messages: [...state.messages, errMsg] }));
    }
  };

  if (collapsed) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2 text-xs text-[#667085] hover:text-[#182230] transition-colors"
        >
          <Bot className="w-4 h-4" />
          <span>{t('chat.expand', locale)}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-[#D9E1EA] flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#1F2937] border border-[#1F2937] flex items-center justify-center">
          <Bot className="w-3 h-3 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-[#182230]">{aiTitle}</div>
          <div className="flex items-center gap-1 text-[9px] text-[#667085]">
            <span className="w-1 h-1.5 rounded-full bg-[#087443] animate-pulse" />
            {loadSettings().apiKey ? 'DeepSeek Live' : t('chat.mockHint', locale)}
          </div>
          {!loadSettings().apiKey && (
            <div className="mt-0.5 text-[9px] text-[#7A5A00]">
              {locale === 'zh-CN' ? '以下为本地模拟回答，仅用于演示与联调。' : 'Replies below are local mock output for demo and integration only.'}
            </div>
          )}
        </div>
        <Badge variant="neutral">{loadSettings().apiKey ? 'LIVE' : 'MOCK'}</Badge>
        <button onClick={toggleCollapsed} className="text-[#667085] hover:text-[#182230] transition-colors">
          <ChevronRight className="w-3.5 h-3.5 rotate-90" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-3 space-y-3 min-h-full">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {streamingText !== null && (
            <div className="flex justify-start">
              <div className="flex gap-2 max-w-[90%]">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1F2937] border border-[#1F2937] flex items-center justify-center mt-0.5">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg rounded-tl-none px-3 py-2">
                  <div className="text-xs text-[#182230] [&>p]:my-1 [&>h2]:text-sm [&>h2]:text-[#9A6700] [&>h2]:font-semibold [&>ul]:my-1 [&>ul]:ml-3 [&>li]:my-0.5 [&>blockquote]:border-l-2 [&>blockquote]:border-[#C99A2E]/40 [&>blockquote]:pl-2 [&_code]:text-[#9A6700] [&_code]:bg-[#FFFAF0] [&_code]:px-1 [&_code]:rounded">
                    <StreamingMarkdown content={streamingText} />
                    <span className="inline-block w-2 h-3 bg-[#1F2937] animate-pulse ml-0.5" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <QuickCommands onSend={handleSend} disabled={isSending} />
      <ChatInput onSend={handleSend} disabled={isSending} />
    </div>
  );
}

function StreamingMarkdown({ content }: { content: string }) {
  // During streaming, render as plain text to avoid partial Markdown issues
  return <div className="whitespace-pre-wrap">{content}</div>;
}

/** 将坐标吸附到最近的裂缝节点上 — 确保标记始终在裂缝表面 */
function snapToFracture(pos: [number, number, number]): [number, number, number] {
  const fractures = useSceneStore.getState().fractures;
  if (fractures.length === 0) return pos;

  let bestDist = Infinity;
  let bestPos: [number, number, number] = pos;

  for (const f of fractures) {
    // 检查裂缝路径上的所有点
    for (const p of f.path) {
      const d = (p[0]-pos[0])**2 + (p[1]-pos[1])**2 + (p[2]-pos[2])**2;
      if (d < bestDist) {
        bestDist = d;
        bestPos = [p[0], p[1], p[2]];
      }
    }
    // 也检查裂缝节点
    for (const n of f.nodes) {
      const p = n.position;
      const d = (p[0]-pos[0])**2 + (p[1]-pos[1])**2 + (p[2]-pos[2])**2;
      if (d < bestDist) {
        bestDist = d;
        bestPos = [p[0], p[1], p[2]];
      }
    }
  }
  return bestPos;
}

function executeActions(action: SceneAction) {
  const store = useSceneStore.getState();
  const audit = createAIActionAuditEntry(action, tf('chat.auditExecute', store.locale, { type: action.type }), Date.now(), {
    gasThreshold: store.gasThreshold,
  });
  store.addAIActionAudit(audit);
  if (!audit.result.allowed) {
    store.addFinding({
      id: `finding-ai-blocked-${audit.id}`,
      sourceType: 'manual',
      sourceId: audit.id,
      title: t('chat.auditBlockedTitle', store.locale),
      description: audit.result.reason,
      level: 'warning',
      status: 'new',
      position: [0, 0, 0],
      truthBoundary: 'human_verified',
      confidence: 1,
      createdAt: audit.createdAt,
      updatedAt: audit.createdAt,
      evidence: [
        {
          id: `evidence-${audit.id}`,
          type: 'operator_note',
          label: 'AI Action Policy',
          value: audit.result.reason,
          truthBoundary: 'human_verified',
          timestamp: audit.createdAt,
          confidence: 1,
        },
      ],
    });
    return;
  }

  switch (action.type) {
    case 'flyTo': {
      if (action.position) {
        // 吸附到最近裂缝点 — 确保相机聚焦在裂缝上，不在岩层空白处
        const snapped = snapToFracture(action.position);
        store.flyTo({ position: snapped, region: action.region, zoom: 'close' });
        // 不再创建高亮球体 — 球体和裂缝形状不匹配
      }
      break;
    }

    case 'highlight': {
      if (action.position) {
        // 高亮也吸附到裂缝点
        const snapped = snapToFracture(action.position);
        store.highlightWithTimer(snapped, action.radius || 3, 5000);
      }
      break;
    }

    case 'markPoints': {
      if (action.points && action.points.length > 0) {
        const createdAt = Date.now();
        const markers: AIMarker[] = action.points.map((p, i) => ({
          id: `ai-marker-${Date.now()}-${i}`,
          // 吸附到最近裂缝点 — 确保标记在裂缝表面上
          position: snapToFracture(p.position),
          label: p.label,
          level: p.level || 'info',
          createdAt,
          detail: p.detail,
          source: p.source,
        }));
        store.addAIMarkers(markers);
        markers.forEach((marker) => {
          store.addFinding(createFindingFromAIMarker(marker, createdAt));
        });
      }
      break;
    }

    case 'clearMarkers': {
      store.clearAIMarkers();
      break;
    }

    case 'toggleLayer': {
      if (action.layer) {
        const key = action.layer as keyof typeof store.layers;
        const current = useSceneStore.getState().layers;
        if (key in current) {
          store.setLayer(key, action.visible ?? !current[key]);
        }
      }
      break;
    }

    case 'activateTool': {
      if (action.tool) {
        store.setActiveTool(action.tool);
      }
      break;
    }

    case 'selectFracture': {
      if (action.fractureId) {
        const fracture = useSceneStore.getState().fractures.find((f) => f.id === action.fractureId);
        if (fracture) {
          store.selectFracture(fracture);
          // 飞到裂缝中心
          const center = fracture.path.reduce(
            (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
            [0, 0, 0]
          );
          const n = fracture.path.length || 1;
          store.flyTo({
            position: [center[0] / n, center[1] / n, center[2] / n],
            region: fracture.name,
            zoom: 'close',
          });
        }
      }
      break;
    }

    case 'setGasThreshold': {
      if (action.threshold !== undefined) {
        store.setGasThreshold(action.threshold);
      }
      break;
    }

    case 'switchScenario': {
      if (action.scenario) {
        store.setScenario(action.scenario);
        // 通过 API 层获取裂缝数据
        fetchFractures(action.scenario).then((newFractures) => {
          useSceneStore.getState().setFractures(newFractures);
        });
      }
      break;
    }

    case 'fitAll': {
      // 全景视角：由相机动态计算当前场景包围盒并拉远，而非固定飞到原点
      store.flyTo({ position: [0, 0, 0], fitAll: true });
      break;
    }
    case 'setColorMode': {
      if (action.mode) {
        store.setFractureColorMode(action.mode);
      }
      break;
    }
  }
}
