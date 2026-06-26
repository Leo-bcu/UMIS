# Phase 1 Finding / Evidence / Truth Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build HIVE's first commercial-grade safety cognition layer: risk Findings, Evidence Cards, Truth Boundary states, and exploration coverage primitives.

**Architecture:** Add a small domain layer under `src/domain/` for safety cognition objects, then connect it to existing alerts, AI markers, annotations, scene store, and UI panels. Keep Phase 1 focused on browser-local state and mock/live-compatible data; do not introduce backend persistence yet.

**Tech Stack:** React 18, TypeScript, Zustand, Zod, existing Tailwind/Radix components, Node built-in test runner with an esbuild bundling script for TypeScript tests.

---

## File Structure

- Create `docs/MODULE_REUSE_SCAN.md`: records build/buy/open-source decisions for every new module.
- Create `src/domain/findingTypes.ts`: typed domain model for Finding, Evidence, Truth Boundary, lifecycle.
- Create `src/domain/findingSchemas.ts`: Zod schemas and runtime validation.
- Create `src/domain/findingFactory.ts`: conversion helpers from Alert / AI Marker / Annotation to Finding.
- Create `src/domain/findingCoverage.ts`: coverage summary primitives.
- Create `scripts/run-node-tests.mjs`: no-new-dependency TypeScript test runner using existing esbuild + Node `--test`.
- Create `src/domain/*.test.ts`: unit tests for schemas, factories, coverage.
- Modify `src/types/index.ts`: export domain-facing IDs only if needed by current code.
- Modify `src/store/useSceneStore.ts`: add minimal Finding store actions.
- Create `src/components/findings/EvidenceCard.tsx`: evidence display.
- Create `src/components/findings/FindingList.tsx`: lightweight Finding queue.
- Modify `src/components/control-panel/AlertFeed.tsx`: allow danger/warning alerts to become Findings.
- Modify `src/components/scene/AIMarkers3D.tsx` or AI action handler: allow AI markers to become Findings.
- Modify `src/components/layout/MainLayout.tsx` or `ControlPanel` composition only if a Finding panel needs mounting.

## Current Implementation Status

Updated: 2026-06-13

- [x] Module reuse scan is indexed in `docs/README.md`.
- [x] No-new-dependency Node `--test` + esbuild runner is implemented.
- [x] Finding domain types, Zod schemas, factories, store actions, and core tests are implemented.
- [x] Alert clicks create measured Findings with sensor evidence.
- [x] AI `markPoints` actions create AI-inferred Findings.
- [x] Control panel shows Evidence Cards, Exploration Coverage, and Truth Boundary labels.
- [x] Manual annotations can be promoted into human-verified Findings.
- [x] Existing PDF reports include a Finding / Truth Boundary section.
- [x] Expanded test suite, `npm run build:check`, `npm run lint`, and backend Python compile pass.

Remaining Phase 1 follow-ups:

- [ ] Replace the lightweight coverage summary with spatial coverage geometry when real mission trajectory / occupancy data exists.

---

## Task 0: Module Reuse Scan

**Files:**
- Create: `docs/MODULE_REUSE_SCAN.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Create reuse scan document**

Create `docs/MODULE_REUSE_SCAN.md` with this initial table:

```md
# HIVE 模块复用扫描记录

> 所有新增模块开工前必须记录成熟库/GitHub/商业参考扫描结果。

| 模块 | 候选成熟方案 | 许可证/风险 | 与现有栈兼容性 | 决策 | 原因 |
|------|--------------|-------------|----------------|------|------|
| 测试 runner | Vitest / Node built-in test runner + esbuild | MIT / Node built-in | Node/esbuild already available | 采用 Node built-in + esbuild | Vitest install was blocked by sandbox/network approval; no-new-dependency runner keeps TDD moving |
| Finding 状态流 | XState | MIT | React 可用，但引入状态机成本 | 暂不采用 | Phase 1 只有 5 个状态，先用类型和纯函数；状态复杂后再引入 |
| 表单校验 | Zod | MIT | 已在依赖中 | 采用 | 可复用现有依赖，适合证据/导出/AI action schema |
| Finding 列表 | TanStack Table | MIT | 兼容 React | 暂不采用 | Phase 1 先做轻量队列；Phase 2 复杂筛选再评估 |
| 时间线 | react-chrono / 自研轻量 | 多数 MIT | 可接 React | 暂不采用 | Mission Timeline 属 Phase 2，不在 Phase 1 引入 |
| 报告生成 | 现有 jsPDF/html2canvas / pdfmake / react-pdf | 多数开源 | 现有实现已可用 | 暂保留现有 | Phase 1 只生成 Finding 报告片段，Phase 4 再评估替换 |
```

- [ ] **Step 2: Index the reuse scan document**

Add a row to `docs/README.md` under "设计参考":

```md
| R6 | [MODULE_REUSE_SCAN.md](./MODULE_REUSE_SCAN.md) | 模块复用扫描记录 (Build/Buy/Open-source Scan) | 2026-06-13 |
```

- [ ] **Step 3: Verify index**

Run:

```bash
rg -n "MODULE_REUSE_SCAN|模块复用" docs/README.md docs/MODULE_REUSE_SCAN.md
```

Expected: both files appear in output.

---

## Task 1: Add Test Runner

**Files:**
- Create: `scripts/run-node-tests.mjs`
- Modify: `package.json`
- Create: `src/domain/findingTypes.test.ts`

- [x] **Step 1: Add no-new-dependency test runner**

Create `scripts/run-node-tests.mjs`:

```js
import { mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(root, 'node_modules/.tmp/node-tests');
const entries = process.argv.slice(2);

if (entries.length === 0) {
  console.error('Usage: node scripts/run-node-tests.mjs <test-file.ts> [...]');
  process.exit(1);
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const outputs = [];

for (const entry of entries) {
  const absEntry = path.resolve(root, entry);
  const outFile = path.join(outdir, entry.replace(/[\\/]/g, '__').replace(/\.tsx?$/, '.mjs'));
  await esbuild.build({
    entryPoints: [absEntry],
    outfile: outFile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    sourcemap: 'inline',
    external: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
  });
  outputs.push(outFile);
}

const result = spawnSync(process.execPath, ['--test', ...outputs], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
```

- [x] **Step 2: Add script**

Add to `package.json` scripts:

```json
"test": "node scripts/run-node-tests.mjs"
```

- [x] **Step 3: Write failing smoke test**

Create `src/domain/findingTypes.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TRUTH_BOUNDARY_LABELS } from './findingTypes';

describe('findingTypes', () => {
  it('defines human-readable truth boundary labels', () => {
    assert.equal(TRUTH_BOUNDARY_LABELS.measured, '实测');
    assert.equal(TRUTH_BOUNDARY_LABELS.ai_inferred, 'AI 推断');
  });
});
```

- [x] **Step 4: Verify RED**

Run:

```bash
npm test -- src/domain/findingTypes.test.ts
```

Observed: FAIL because `src/domain/findingTypes.ts` did not exist.

- [x] **Step 5: Add minimal implementation**

Create `src/domain/findingTypes.ts`:

```ts
export type TruthBoundary = 'measured' | 'interpolated' | 'ai_inferred' | 'unknown' | 'human_verified';

export const TRUTH_BOUNDARY_LABELS: Record<TruthBoundary, string> = {
  measured: '实测',
  interpolated: '插值',
  ai_inferred: 'AI 推断',
  unknown: '未探明',
  human_verified: '人工确认',
};
```

- [x] **Step 6: Verify GREEN**

Run:

```bash
npm test -- src/domain/findingTypes.test.ts
```

Observed: PASS.

---

## Task 2: Define Finding Domain Model

**Files:**
- Modify: `src/domain/findingTypes.ts`
- Create: `src/domain/findingSchemas.ts`
- Create: `src/domain/findingSchemas.test.ts`

- [ ] **Step 1: Write failing schema test**

Create `src/domain/findingSchemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findingSchema } from './findingSchemas';

describe('findingSchema', () => {
  it('accepts a measured danger finding with evidence', () => {
    const result = findingSchema.safeParse({
      id: 'finding-alert-0001',
      sourceType: 'alert',
      sourceId: 'alert-0001',
      title: 'CH4 超限',
      description: 'R-001 回传 CH4=2.4%',
      level: 'danger',
      status: 'new',
      position: [1, 2, 3],
      truthBoundary: 'measured',
      confidence: 0.92,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      evidence: [
        {
          id: 'ev-1',
          type: 'sensor',
          label: 'CH4',
          value: '2.4%',
          truthBoundary: 'measured',
          timestamp: 1710000000000,
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/domain/findingSchemas.test.ts
```

Expected: FAIL because `findingSchemas.ts` does not exist.

- [ ] **Step 3: Implement domain types**

Extend `src/domain/findingTypes.ts`:

```ts
export type FindingLevel = 'danger' | 'warning' | 'info';
export type FindingStatus = 'new' | 'acknowledged' | 'assigned' | 'reviewed' | 'closed';
export type FindingSourceType = 'alert' | 'ai_marker' | 'annotation' | 'manual';
export type EvidenceType = 'sensor' | 'robot' | 'pointcloud' | 'ai_reasoning' | 'operator_note' | 'export';

export interface FindingEvidence {
  id: string;
  type: EvidenceType;
  label: string;
  value: string;
  truthBoundary: TruthBoundary;
  timestamp: number;
  robotId?: string;
  confidence?: number;
}

export interface Finding {
  id: string;
  sourceType: FindingSourceType;
  sourceId: string;
  title: string;
  description: string;
  level: FindingLevel;
  status: FindingStatus;
  position: [number, number, number];
  truthBoundary: TruthBoundary;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  assignee?: string;
  evidence: FindingEvidence[];
}
```

- [ ] **Step 4: Implement Zod schemas**

Create `src/domain/findingSchemas.ts`:

```ts
import { z } from 'zod';

export const truthBoundarySchema = z.enum(['measured', 'interpolated', 'ai_inferred', 'unknown', 'human_verified']);
export const findingLevelSchema = z.enum(['danger', 'warning', 'info']);
export const findingStatusSchema = z.enum(['new', 'acknowledged', 'assigned', 'reviewed', 'closed']);
export const findingSourceTypeSchema = z.enum(['alert', 'ai_marker', 'annotation', 'manual']);
export const evidenceTypeSchema = z.enum(['sensor', 'robot', 'pointcloud', 'ai_reasoning', 'operator_note', 'export']);

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const findingEvidenceSchema = z.object({
  id: z.string().min(1),
  type: evidenceTypeSchema,
  label: z.string().min(1),
  value: z.string().min(1),
  truthBoundary: truthBoundarySchema,
  timestamp: z.number(),
  robotId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const findingSchema = z.object({
  id: z.string().min(1),
  sourceType: findingSourceTypeSchema,
  sourceId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  level: findingLevelSchema,
  status: findingStatusSchema,
  position: vec3Schema,
  truthBoundary: truthBoundarySchema,
  confidence: z.number().min(0).max(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  assignee: z.string().optional(),
  evidence: z.array(findingEvidenceSchema),
});
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm test -- src/domain/findingSchemas.test.ts src/domain/findingTypes.test.ts
```

Expected: PASS.

---

## Task 3: Convert Alerts to Findings

**Files:**
- Create: `src/domain/findingFactory.ts`
- Create: `src/domain/findingFactory.test.ts`

- [ ] **Step 1: Write failing alert conversion test**

Create `src/domain/findingFactory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createFindingFromAlert } from './findingFactory';
import type { AlertEvent } from '../data/alertDataGenerator';

describe('createFindingFromAlert', () => {
  it('converts a danger alert into a measured finding', () => {
    const alert: AlertEvent = {
      id: 'alert-0001',
      level: 'danger',
      type: 'gas_overload',
      title: 'CH4 超限',
      description: 'R-001 检测到 CH4 超限',
      robotId: 'R-001',
      position: [1, 2, 3],
      timestamp: 1710000000000,
      acknowledged: false,
    };

    const finding = createFindingFromAlert(alert);

    expect(finding.id).toBe('finding-alert-alert-0001');
    expect(finding.level).toBe('danger');
    expect(finding.status).toBe('new');
    expect(finding.truthBoundary).toBe('measured');
    expect(finding.evidence[0]).toMatchObject({
      type: 'sensor',
      robotId: 'R-001',
      truthBoundary: 'measured',
    });
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/domain/findingFactory.test.ts
```

Expected: FAIL because `findingFactory.ts` does not exist.

- [ ] **Step 3: Implement alert conversion**

Create `src/domain/findingFactory.ts`:

```ts
import type { AlertEvent } from '../data/alertDataGenerator';
import type { AIMarker } from '../types';
import type { Finding } from './findingTypes';

const fallbackPosition: [number, number, number] = [0, 0, 0];

export function createFindingFromAlert(alert: AlertEvent): Finding {
  return {
    id: `finding-alert-${alert.id}`,
    sourceType: 'alert',
    sourceId: alert.id,
    title: alert.title,
    description: alert.description,
    level: alert.level,
    status: alert.acknowledged ? 'acknowledged' : 'new',
    position: alert.position ?? fallbackPosition,
    truthBoundary: 'measured',
    confidence: alert.level === 'danger' ? 0.92 : 0.78,
    createdAt: alert.timestamp,
    updatedAt: alert.timestamp,
    evidence: [
      {
        id: `evidence-${alert.id}-sensor`,
        type: 'sensor',
        label: alert.type,
        value: alert.description,
        truthBoundary: 'measured',
        timestamp: alert.timestamp,
        robotId: alert.robotId,
        confidence: alert.level === 'danger' ? 0.92 : 0.78,
      },
    ],
  };
}

export function createFindingFromAIMarker(marker: AIMarker, timestamp = Date.now()): Finding {
  return {
    id: `finding-ai-${marker.id}`,
    sourceType: 'ai_marker',
    sourceId: marker.id,
    title: marker.label,
    description: marker.detail ?? marker.label,
    level: marker.level,
    status: 'new',
    position: marker.position,
    truthBoundary: 'ai_inferred',
    confidence: 0.68,
    createdAt: timestamp,
    updatedAt: timestamp,
    evidence: [
      {
        id: `evidence-${marker.id}-ai`,
        type: 'ai_reasoning',
        label: marker.source ?? 'AI 推理',
        value: marker.detail ?? marker.label,
        truthBoundary: 'ai_inferred',
        timestamp,
        confidence: 0.68,
      },
    ],
  };
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- src/domain/findingFactory.test.ts
```

Expected: PASS.

---

## Task 4: Add Finding Store Slice

**Files:**
- Modify: `src/store/useSceneStore.ts`
- Create: `src/store/useSceneStore.findings.test.ts`

- [ ] **Step 1: Write failing store behavior test**

Create `src/store/useSceneStore.findings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { useSceneStore } from './useSceneStore';
import type { Finding } from '../domain/findingTypes';

function sampleFinding(id: string): Finding {
  return {
    id,
    sourceType: 'manual',
    sourceId: id,
    title: '测试风险',
    description: '测试描述',
    level: 'warning',
    status: 'new',
    position: [0, 0, 0],
    truthBoundary: 'measured',
    confidence: 0.8,
    createdAt: 1,
    updatedAt: 1,
    evidence: [],
  };
}

describe('useSceneStore findings', () => {
  it('adds and updates a finding status', () => {
    const store = useSceneStore.getState();
    store.clearFindings();
    store.addFinding(sampleFinding('finding-1'));
    store.updateFindingStatus('finding-1', 'acknowledged');

    const finding = useSceneStore.getState().findings[0];
    expect(finding.id).toBe('finding-1');
    expect(finding.status).toBe('acknowledged');
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/store/useSceneStore.findings.test.ts
```

Expected: FAIL because store actions do not exist.

- [ ] **Step 3: Add store state and actions**

Modify `src/store/useSceneStore.ts`:

```ts
import type { Finding, FindingStatus } from '../domain/findingTypes';
```

Add to `SceneStore`:

```ts
findings: Finding[];
addFinding: (finding: Finding) => void;
updateFindingStatus: (id: string, status: FindingStatus) => void;
clearFindings: () => void;
```

Add to store initializer:

```ts
findings: [],
addFinding: (finding) => set((state) => ({
  findings: state.findings.some((f) => f.id === finding.id)
    ? state.findings
    : [finding, ...state.findings],
})),
updateFindingStatus: (id, status) => set((state) => ({
  findings: state.findings.map((finding) =>
    finding.id === id
      ? { ...finding, status, updatedAt: Date.now() }
      : finding
  ),
})),
clearFindings: () => set({ findings: [] }),
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- src/store/useSceneStore.findings.test.ts
```

Expected: PASS.

---

## Task 5: Evidence Card UI

**Files:**
- Create: `src/components/findings/EvidenceCard.tsx`
- Create: `src/components/findings/FindingList.tsx`

- [ ] **Step 1: Create EvidenceCard component**

Create `src/components/findings/EvidenceCard.tsx`:

```tsx
import type { Finding } from '../../domain/findingTypes';
import { TRUTH_BOUNDARY_LABELS } from '../../domain/findingTypes';

const LEVEL_LABELS = {
  danger: '高危',
  warning: '警告',
  info: '信息',
};

export function EvidenceCard({ finding }: { finding: Finding }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0F111A]/90 p-2 text-[10px] text-[#E0E0E8]">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{finding.title}</div>
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-[#FFE600]">
          {LEVEL_LABELS[finding.level]}
        </span>
      </div>
      <p className="mt-1 text-[#A0A0B0]">{finding.description}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[#A0A0B0]">
        <span>可信边界</span>
        <span className="text-right text-[#E0E0E8]">{TRUTH_BOUNDARY_LABELS[finding.truthBoundary]}</span>
        <span>置信度</span>
        <span className="text-right text-[#E0E0E8]">{Math.round(finding.confidence * 100)}%</span>
      </div>
      {finding.evidence.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
          {finding.evidence.map((evidence) => (
            <div key={evidence.id} className="flex justify-between gap-2">
              <span className="text-[#A0A0B0]">{evidence.label}</span>
              <span className="text-right">{evidence.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create FindingList component**

Create `src/components/findings/FindingList.tsx`:

```tsx
import { useSceneStore } from '../../store/useSceneStore';
import { EvidenceCard } from './EvidenceCard';

export function FindingList() {
  const findings = useSceneStore((s) => s.findings);

  if (findings.length === 0) return null;

  return (
    <div className="space-y-2">
      {findings.slice(0, 5).map((finding) => (
        <EvidenceCard key={finding.id} finding={finding} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

Run:

```bash
npm run build:check
```

Expected: PASS.

---

## Task 6: Wire Alerts Into Findings

**Files:**
- Modify: `src/components/control-panel/AlertFeed.tsx`

- [ ] **Step 1: Add store action and factory import**

Add imports:

```ts
import { createFindingFromAlert } from '../../domain/findingFactory';
```

Inside `AlertFeed`, read:

```ts
const addFinding = useSceneStore((s) => s.addFinding);
```

- [ ] **Step 2: Convert alert when clicked**

In `handleAlertClick`, after existing fly/highlight behavior:

```ts
addFinding(createFindingFromAlert(alert));
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run build:check
npm run lint
```

Expected: build passes; lint has no errors.

---

## Task 7: Mount Finding Queue

**Files:**
- Modify: `src/components/control-panel/ControlPanel.tsx` or nearest left-panel composition file

- [ ] **Step 1: Locate panel composition**

Run:

```bash
rg -n "AlertFeed|RobotFleet|SensorTrends|LayerToggle" src/components
```

Expected: identify the component composing left control panel.

- [ ] **Step 2: Mount FindingList below alerts**

Add:

```tsx
import { FindingList } from '../findings/FindingList';
```

Render immediately after `AlertFeed`:

```tsx
<FindingList />
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run build:check
npm run lint
```

Expected: build passes; lint has no errors.

---

## Task 8: Phase 1 Verification

**Files:**
- No new files.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: exit 0, no errors.

- [ ] **Step 3: Run build check**

Run:

```bash
npm run build:check
```

Expected: exit 0. Existing chunk warnings are acceptable.

- [ ] **Step 4: Update docs**

Append Phase 1 completion notes to:

```md
docs/PRODUCT_ROADMAP_90.md
progress.md
```

Include:

- What was implemented.
- What mature modules were adopted or rejected.
- Remaining warnings or gaps.
