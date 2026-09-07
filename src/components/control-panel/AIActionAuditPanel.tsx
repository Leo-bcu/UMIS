import { RotateCcw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useSceneStore } from '../../store/useSceneStore';
import { createUndoAction } from '../../domain/aiActionPolicy';

export function AIActionAuditPanel() {
  const audit = useSceneStore((s) => s.aiActionAudit);
  const markAIActionUndone = useSceneStore((s) => s.markAIActionUndone);

  if (audit.length === 0) return null;

  const undoAction = (entryId: string) => {
    const store = useSceneStore.getState();
    const entry = store.aiActionAudit.find((item) => item.id === entryId);
    if (!entry?.before || entry.undoneAt) return;

    const undo = createUndoAction(entry.action, entry.before);
    if (!undo) return;

    if (undo.type === 'setGasThreshold' && undo.threshold !== undefined) {
      store.setGasThreshold(undo.threshold);
    } else if (undo.type === 'clearMarkers') {
      store.clearAIMarkers();
    } else if (undo.type === 'highlight') {
      store.clearHighlight();
    }
    markAIActionUndone(entryId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#087443]" />
          <span>AI 动作审计</span>
          <span className="ml-auto text-[9px] font-mono text-[#667085]">{audit.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {audit.slice(0, 4).map((entry) => (
          <div key={entry.id} className="rounded border border-[#D9E1EA] bg-[#F8FAFC]/70 px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-[#182230]">{entry.actionType}</span>
              <div className="flex items-center gap-1.5">
                {entry.undoable && entry.before && !entry.undoneAt && (
                  <button
                    onClick={() => undoAction(entry.id)}
                    className="inline-flex items-center gap-1 rounded border border-[#D9E1EA] bg-white px-1.5 py-0.5 text-[9px] text-[#667085] hover:border-[#B7C3D0] hover:text-[#182230]"
                    title="撤销该 AI 动作"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    撤销
                  </button>
                )}
                <span className={`text-[9px] ${entry.result.allowed ? 'text-[#087443]' : 'text-[#B42318]'}`}>
                  {entry.undoneAt ? '已撤销' : entry.result.allowed ? '已允许' : '已拦截'}
                </span>
              </div>
            </div>
            <div className="mt-0.5 text-[9px] leading-tight text-[#667085]">
              {entry.result.requiresHumanReview ? '需要人工复核 · ' : ''}{entry.result.reason}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
