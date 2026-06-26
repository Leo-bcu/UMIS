import { useState } from 'react';
import { Button } from '../ui/button';
import { Send } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { t } from '../../domain/i18nCatalog';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState('');
  const locale = useSceneStore((s) => s.locale);

  const handleSubmit = () => {
    if (!disabled && input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div className="p-3 border-t border-[#D9E1EA]">
      <div className="flex gap-2 items-end">
        <input
          data-testid="chat-command-input"
          type="text"
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={t('chat.placeholder', locale)}
          className="flex-1 bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg px-3 py-2 text-xs text-[#182230] placeholder:text-[#98A2B3] focus:outline-none focus:border-[#1F2937]/40 transition-colors"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
