export interface LLMSettings {
  provider: 'deepseek' | 'openai' | 'qwen' | 'custom';
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const LLM_PRESETS: Record<LLMSettings['provider'], { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  custom: { baseUrl: '', model: '' },
};

const STORAGE_KEY = 'llm-settings';

export function loadSettings(): LLMSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LLMSettings;
  } catch {
    // Ignore malformed localStorage and fall back to environment/default settings.
  }

  const envKey = import.meta.env.VITE_LLM_API_KEY as string | undefined;
  const envUrl = import.meta.env.VITE_LLM_BASE_URL as string | undefined;
  const envModel = import.meta.env.VITE_LLM_MODEL as string | undefined;

  if (envKey) {
    return {
      provider: 'deepseek',
      baseUrl: envUrl || LLM_PRESETS.deepseek.baseUrl,
      apiKey: envKey,
      model: envModel || LLM_PRESETS.deepseek.model,
    };
  }

  return {
    provider: 'deepseek',
    baseUrl: LLM_PRESETS.deepseek.baseUrl,
    apiKey: '',
    model: LLM_PRESETS.deepseek.model,
  };
}

export function saveSettings(settings: LLMSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
