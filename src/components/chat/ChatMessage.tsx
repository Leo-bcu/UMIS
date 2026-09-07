import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types';

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] bg-[#1F2937] border border-[#1F2937] rounded-lg rounded-tr-none px-3 py-2">
          <div className="text-xs text-white">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex gap-2 max-w-[90%]">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1F2937] border border-[#1F2937] flex items-center justify-center mt-0.5">
          <Bot className="w-3 h-3 text-white" />
        </div>
        <div className="bg-[#F8FAFC] border border-[#D9E1EA] rounded-lg rounded-tl-none px-3 py-2">
          <div className="text-xs text-[#182230] prose-chat [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>h2]:text-sm [&>h2]:text-[#9A6700] [&>h2]:font-semibold [&>h2]:mb-1 [&>h2]:mt-2 [&>ul]:my-1 [&>ul]:ml-3 [&>li]:my-0.5 [&>table]:my-2 [&>blockquote]:border-l-2 [&>blockquote]:border-[#C99A2E]/40 [&>blockquote]:pl-2 [&>blockquote]:text-[#667085] [&_code]:text-[#9A6700] [&_code]:bg-[#FFFAF0] [&_code]:px-1 [&_code]:rounded [&_code]:text-[10px] [&_td]:border [&_td]:border-[#D9E1EA] [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:border [&_th]:border-[#D9E1EA] [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:text-[#9A6700]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
          {message.action && (
            <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[#9A6700]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
              Generative UI 已触发：视角飞行 + 区域高亮
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
