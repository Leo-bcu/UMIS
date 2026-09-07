import { useQuickCommands } from '../../hooks/useQuickCommands';
import { useSceneStore } from '../../store/useSceneStore';

interface QuickCommandsProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function QuickCommands({ onSend, disabled = false }: QuickCommandsProps) {
  const { data: quickCommands } = useQuickCommands();
  const locale = useSceneStore((s) => s.locale);

  return (
    <div className="px-3 py-2 border-t border-[#D9E1EA]">
      <div className="text-[9px] text-[#667085] tracking-wider uppercase mb-1.5">
        {locale === 'zh-CN' ? '快捷指令 · 本地演示' : 'Quick Commands · Local Demo'}
      </div>
      <div className="flex flex-wrap gap-1">
        {quickCommands.map((cmd) => (
          <button
            key={cmd.command}
            type="button"
            data-testid="quick-command"
            aria-label={`${locale === 'zh-CN' ? '执行快捷指令' : 'Run quick command'}: ${cmd.label}`}
            disabled={disabled}
            className="inline-flex items-center rounded-full border border-[#D9E1EA] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-medium text-[#667085] transition-all hover:border-[#B7C3D0] hover:bg-[#EEF2F6] hover:text-[#182230] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C99A2E]/30 disabled:pointer-events-none disabled:opacity-50"
            onClick={() => onSend(cmd.command)}
          >
            {cmd.label}
          </button>
        ))}
      </div>
    </div>
  );
}
