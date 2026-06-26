import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Settings, X, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { LLM_PRESETS, loadSettings, saveSettings, type LLMSettings } from '../../lib/llmSettings';
import { useSceneStore } from '../../store/useSceneStore';
import { t } from '../../domain/i18nCatalog';

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<LLMSettings>(loadSettings);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const locale = useSceneStore((s) => s.locale);

  useEffect(() => {
    setSettings(loadSettings());
    setTestStatus('idle');
    setTestMessage('');
  }, [open]);

  const handleProviderChange = (provider: LLMSettings['provider']) => {
    const preset = LLM_PRESETS[provider];
    setSettings((s) => ({
      ...s,
      provider,
      baseUrl: preset.baseUrl || s.baseUrl,
      model: preset.model || s.model,
    }));
    setTestStatus('idle');
  };

  // M8: 连接测试
  const handleTest = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const res = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
          stream: false,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${errText.slice(0, 100)}`);
      }
      setTestStatus('success');
      setTestMessage(locale === 'zh-CN' ? `${t('settings.success', locale)} · ${settings.model}` : `${t('settings.success', locale)} · ${settings.model}`);
    } catch (e) {
      setTestStatus('fail');
      setTestMessage((e as Error).message || t('settings.fail', locale));
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] text-[#667085] hover:text-[#C99A2E] hover:bg-[#F8FAFC] transition-all"
          title={t('settings.title', locale)}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-[#FFFFFF] border border-[#D9E1EA] rounded-xl p-6 z-50 shadow-2xl">
          <Dialog.Title className="text-sm font-bold text-[#182230] mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#C99A2E]" />
            {t('settings.title', locale)}
          </Dialog.Title>
          <Dialog.Description className="text-[10px] text-[#667085] mb-4">
            {t('settings.description', locale)}
          </Dialog.Description>

          <div className="space-y-4">
            {/* Provider */}
            <div>
              <label className="block text-[10px] text-[#667085] mb-1.5">{t('settings.provider', locale)}</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['deepseek', 'openai', 'qwen', 'custom'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`px-2 py-1.5 rounded text-[10px] font-medium transition-all ${
                      settings.provider === p
                        ? 'bg-[#C99A2E]/20 text-[#C99A2E] border border-[#C99A2E]/40'
                        : 'bg-[#F8FAFC] text-[#667085] border border-[#D9E1EA] hover:bg-[#EEF2F6]'
                    }`}
                  >
                    {p === 'deepseek' ? 'DeepSeek' : p === 'openai' ? 'OpenAI' : p === 'qwen' ? (locale === 'zh-CN' ? '通义千问' : 'Qwen') : (locale === 'zh-CN' ? '自定义' : 'Custom')}
                  </button>
                ))}
              </div>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-[10px] text-[#667085] mb-1.5">{t('settings.baseUrl', locale)}</label>
              <input
                type="text"
                value={settings.baseUrl}
                onChange={(e) => { setSettings((s) => ({ ...s, baseUrl: e.target.value })); setTestStatus('idle'); }}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#D9E1EA] rounded text-xs text-[#182230] focus:outline-none focus:border-[#C99A2E]/40"
                placeholder="https://api.deepseek.com"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-[10px] text-[#667085] mb-1.5">{t('settings.apiKey', locale)}</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) => { setSettings((s) => ({ ...s, apiKey: e.target.value })); setTestStatus('idle'); }}
                  className="w-full px-3 py-2 pr-8 bg-[#F8FAFC] border border-[#D9E1EA] rounded text-xs text-[#182230] focus:outline-none focus:border-[#C99A2E]/40"
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#C99A2E]"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="block text-[10px] text-[#667085] mb-1.5">{t('settings.model', locale)}</label>
              <input
                type="text"
                value={settings.model}
                onChange={(e) => { setSettings((s) => ({ ...s, model: e.target.value })); setTestStatus('idle'); }}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#D9E1EA] rounded text-xs text-[#182230] focus:outline-none focus:border-[#C99A2E]/40"
                placeholder="deepseek-chat"
              />
            </div>

            {/* M8: 连接测试 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={testStatus === 'testing'}
                className="px-3 py-1.5 bg-[#F8FAFC] border border-[#D9E1EA] rounded text-[10px] text-[#182230] hover:bg-[#EEF2F6] transition-all flex items-center gap-1.5"
              >
                {testStatus === 'testing' ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> {t('settings.testing', locale)}</>
                ) : (
                  <>{t('settings.test', locale)}</>
                )}
              </button>
              {testStatus === 'success' && (
                <span className="flex items-center gap-1 text-[10px] text-[#087443]">
                  <CheckCircle2 className="w-3 h-3" /> {testMessage}
                </span>
              )}
              {testStatus === 'fail' && (
                <span className="flex items-center gap-1 text-[10px] text-[#B42318]">
                  <AlertCircle className="w-3 h-3" /> {testMessage}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-xs text-[#667085] hover:text-[#182230] transition-colors">
                {t('settings.cancel', locale)}
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[#1F2937] text-white border border-[#1F2937] rounded text-xs font-medium hover:bg-[#111827] transition-all"
            >
              {t('settings.save', locale)}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-[#667085] hover:text-[#182230]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
