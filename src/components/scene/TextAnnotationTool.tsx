import { useState, useCallback, useEffect } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { useCanvasInteraction } from './useCanvasInteraction';
import type { Annotation } from '../../types';
import { t } from '../../domain/i18nCatalog';

/**
 * 文字标注工具 — 点击位置，输入文字，保存
 */
export function TextAnnotationTool() {
  const activeTool = useSceneStore((s) => s.activeTool);
  const setActiveTool = useSceneStore((s) => s.setActiveTool);
  const addAnnotation = useSceneStore((s) => s.addAnnotation);
  const locale = useSceneStore((s) => s.locale);

  const isActive = activeTool === 'text';

  const [anchor, setAnchor] = useState<THREE.Vector3 | null>(null);
  const [input, setInput] = useState('');
  const trimmedInput = input.trim();

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAnchor(null);
        setInput('');
        setActiveTool('none');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, setActiveTool]);

  useCanvasInteraction(isActive && !anchor, {
    onPointerDown: useCallback((pt: THREE.Vector3) => {
      setAnchor(pt);
      setInput('');
    }, []),
  }, { snapToNetwork: false });

  const handleConfirm = useCallback(() => {
    if (!anchor || !trimmedInput) return;
    if (trimmedInput && anchor) {
      const annotation: Annotation = {
        id: `anno-text-${Date.now()}`,
        type: 'text',
        points: [[anchor.x, anchor.y, anchor.z] as [number, number, number]],
        label: trimmedInput,
        createdAt: Date.now(),
      };
      addAnnotation(annotation);
    }
    setAnchor(null);
    setInput('');
    setActiveTool('none');
  }, [trimmedInput, anchor, addAnnotation, setActiveTool]);

  const handleCancel = useCallback(() => {
    setAnchor(null);
    setInput('');
  }, []);

  if (!isActive && !anchor) return null;

  return (
    <>
      {anchor && (
        <mesh position={anchor} userData={{ noRaycast: true }}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color="#FFE600" />
        </mesh>
      )}

      {anchor && (
        <Html position={[anchor.x, anchor.y + 2, anchor.z]} center>
          <div data-testid="text-annotation-editor" className="glass-panel px-3 py-2.5 text-xs min-w-[200px]" style={{ pointerEvents: 'auto' }}>
            <div className="text-[#FFE600] font-bold mb-2 text-[11px]">{t('tool.text', locale)}</div>
            <input
              data-testid="text-annotation-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder={locale === 'zh-CN' ? '输入标注内容...' : 'Enter note text...'}
              autoFocus
              className="w-full px-2 py-1.5 text-[10px] bg-black/30 text-[#E0E0E8] border border-white/10 rounded outline-none focus:border-[#FFE600]/40"
            />
            <div className="flex gap-2 mt-2">
              <button
                data-testid="text-annotation-confirm"
                className="flex-1 px-2 py-1.5 text-[10px] bg-[#FFE600]/20 text-[#FFE600] rounded hover:bg-[#FFE600]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#FFE600]/20"
                onClick={handleConfirm}
                disabled={!trimmedInput}
              >{locale === 'zh-CN' ? '确认 (Enter)' : 'Confirm (Enter)'}</button>
              <button data-testid="text-annotation-cancel" className="px-2 py-1.5 text-[10px] bg-white/5 text-[#A0A0B0] rounded hover:text-[#E0E0E8] hover:bg-white/10 transition-all" onClick={handleCancel}>{locale === 'zh-CN' ? '重选' : 'Reselect'}</button>
            </div>
          </div>
        </Html>
      )}

      {isActive && !anchor && (
        <Html position={[0, 0, 0]} center>
          <div className="glass-panel px-3 py-2 text-[10px] text-[#FFE600] animate-pulse whitespace-nowrap" style={{ pointerEvents: 'none' }}>
            {locale === 'zh-CN' ? 'F3 文字标注 · 点击任意位置设置标注（ESC取消）' : 'F3 Text Note · click anywhere to place a note (ESC to cancel)'}
          </div>
        </Html>
      )}
    </>
  );
}
