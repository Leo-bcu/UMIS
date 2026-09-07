# HIVE 90+ Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-maintained dashboard outputs with a unified raw-mock-to-derived-data pipeline, add tolerant API normalization, and harden scenario consistency/interaction until HIVE reaches a 90+ demo standard.

**Architecture:** Introduce a single scene dataset composition layer that builds raw observations, telemetry, events, and derived summaries per scene. Route mock APIs and key hooks through tolerant adapters and shared selectors so panels, alerts, trends, exports, and details all consume the same source of truth.

**Tech Stack:** React 18, TypeScript, Zustand, Vite, existing Node `--test` suite, FastAPI-compatible API contracts

---

## File Structure

- Create: `src/domain/sceneDataset.ts` — canonical raw scene dataset and derived summaries
- Create: `src/domain/sceneDataset.test.ts` — dataset consistency regression tests
- Create: `src/api/normalizers.ts` — tolerant field/enum/unit normalization helpers for future live data drift
- Create: `src/api/normalizers.test.ts` — adapter tolerance tests
- Modify: `src/api/sceneApi.ts` — consume unified dataset in mock mode
- Modify: `src/api/robotApi.ts` — consume unified dataset in mock mode
- Modify: `src/api/alertApi.ts` — consume unified dataset in mock mode
- Modify: `src/hooks/useSceneStats.ts` — use unified summary instead of ad hoc fracture math
- Modify: `src/hooks/useSensorTrend.ts` — keep single source behavior aligned with dataset
- Modify: `src/data/mockDataGenerator.ts` — stop being an isolated legacy truth source
- Modify: `src/data/robotDataGenerator.ts` / `src/data/alertDataGenerator.ts` — reuse or delegate into scene dataset composition
- Modify: `docs/README.md` — index this plan
- Modify: `progress.md` / `task_plan.md` / `findings.md` — record execution

---

### Task 1: Establish canonical scene dataset domain

**Files:**
- Create: `src/domain/sceneDataset.ts`
- Test: `src/domain/sceneDataset.test.ts`

- [ ] **Step 1: Write failing dataset consistency tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneDataset } from './sceneDataset';

test('scene dataset keeps robot stats consistent with robot list', () => {
  const dataset = buildSceneDataset('fracture', 'coal');
  assert.equal(dataset.summary.robotFleet.total, dataset.robots.length);
  assert.equal(
    dataset.summary.robotFleet.online +
      dataset.summary.robotFleet.offline +
      dataset.summary.robotFleet.lowBattery +
      dataset.summary.robotFleet.error +
      dataset.summary.robotFleet.maintenance,
    dataset.robots.length,
  );
});

test('scene dataset keeps alert summary consistent with alerts list', () => {
  const dataset = buildSceneDataset('fracture', 'gold');
  assert.equal(dataset.summary.alerts.total, dataset.alerts.length);
  assert.equal(
    dataset.summary.alerts.danger +
      dataset.summary.alerts.warning +
      dataset.summary.alerts.info,
    dataset.alerts.length,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs src/domain/sceneDataset.test.ts`
Expected: FAIL because `sceneDataset.ts` does not exist yet.

- [ ] **Step 3: Implement canonical dataset builder**

```ts
export interface SceneDataset {
  dataSource: DataSourceType;
  scenario: ScenarioType;
  fractures: Fracture[];
  robots: Robot[];
  alerts: AlertEvent[];
  summary: {
    scene: SceneStats;
    robotFleet: RobotFleetStats;
    alerts: {
      total: number;
      danger: number;
      warning: number;
      info: number;
      unacknowledged: number;
    };
  };
}

export function buildSceneDataset(
  dataSource: DataSourceType,
  scenario: ScenarioType,
): SceneDataset {
  // compose fractures/robots/alerts once, derive summaries from the same arrays
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs src/domain/sceneDataset.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/sceneDataset.ts src/domain/sceneDataset.test.ts
git commit -m "feat: add canonical scene dataset domain"
```

### Task 2: Add tolerant normalization layer for future API drift

**Files:**
- Create: `src/api/normalizers.ts`
- Test: `src/api/normalizers.test.ts`

- [ ] **Step 1: Write failing normalization tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRobotRecord } from './normalizers';

test('normalizeRobotRecord accepts alternate battery and status fields', () => {
  const normalized = normalizeRobotRecord({
    id: 'R-001',
    batteryLevel: 82,
    state: 'critical',
    mesh_role: 'relay',
    coords: [1, 2, 3],
  });

  assert.equal(normalized.battery, 82);
  assert.equal(normalized.status, 'error');
  assert.deepEqual(normalized.position, [1, 2, 3]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs src/api/normalizers.test.ts`
Expected: FAIL because `normalizers.ts` does not exist yet.

- [ ] **Step 3: Implement tolerant adapters**

```ts
const ROBOT_STATUS_ALIASES: Record<string, RobotStatus> = {
  online: 'online',
  active: 'online',
  idle: 'maintenance',
  critical: 'error',
  error: 'error',
  warning: 'low_battery',
};

export function normalizeRobotRecord(input: Record<string, unknown>): Robot {
  // alias mapping, safe defaults, position coercion, fallback quality-safe values
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs src/api/normalizers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/normalizers.ts src/api/normalizers.test.ts
git commit -m "feat: add tolerant api normalizers"
```

### Task 3: Route mock APIs through the canonical dataset

**Files:**
- Modify: `src/api/sceneApi.ts`
- Modify: `src/api/robotApi.ts`
- Modify: `src/api/alertApi.ts`
- Test: `src/domain/sceneDataset.test.ts`

- [ ] **Step 1: Write/extend tests for same-source API behavior**

```ts
test('scene dataset scene stats and robots stay aligned across api consumers', () => {
  const dataset = buildSceneDataset('fracture', 'oil');
  assert.equal(dataset.summary.scene.totalNodes > 0, true);
  assert.equal(dataset.summary.robotFleet.total, dataset.robots.length);
});
```

- [ ] **Step 2: Run test to verify current behavior fails or is uncovered**

Run: `node scripts/run-node-tests.mjs src/domain/sceneDataset.test.ts`
Expected: either FAIL or missing coverage for API alignment.

- [ ] **Step 3: Update APIs to consume `buildSceneDataset(...)`**

```ts
async function getMockStats(dataSource: DataSourceType, scenario: ScenarioType): Promise<SceneStats> {
  const { buildSceneDataset } = await import('../domain/sceneDataset');
  return buildSceneDataset(dataSource, scenario).summary.scene;
}
```

- [ ] **Step 4: Run tests to verify API-backed consistency passes**

Run: `node scripts/run-node-tests.mjs src/domain/sceneDataset.test.ts src/api/alertApi.scenario.test.ts src/data/robotDataGenerator.scenario.test.ts src/data/alertDataGenerator.scenario.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/sceneApi.ts src/api/robotApi.ts src/api/alertApi.ts src/domain/sceneDataset.test.ts
git commit -m "refactor: route mock apis through scene dataset"
```

### Task 4: Replace ad hoc scene summary calculations in hooks

**Files:**
- Modify: `src/hooks/useSceneStats.ts`
- Modify: `src/hooks/useSensorTrend.ts`
- Test: `src/domain/sceneMetricSummary.test.ts`
- Test: `src/data/sensorTrendGenerator.test.ts`

- [ ] **Step 1: Add failing test for stats derived from canonical dataset**

```ts
test('buildSceneDataset scene summary matches expected threshold accounting', () => {
  const dataset = buildSceneDataset('underground', 'underground');
  assert.equal(dataset.summary.scene.overThreshold >= 0, true);
});
```

- [ ] **Step 2: Run test to verify current hook path is still ad hoc**

Run: `node scripts/run-node-tests.mjs src/domain/sceneDataset.test.ts src/domain/sceneMetricSummary.test.ts`
Expected: failing or incomplete coverage.

- [ ] **Step 3: Refactor hooks to use canonical selectors**

```ts
const dataset = useMemo(() => buildSceneDataset(dataSource, scenario), [dataSource, scenario]);
return { data: dataset.summary.scene, loading: false, error: null, refetch: () => {} };
```

- [ ] **Step 4: Run tests to verify summary/trend behavior still passes**

Run: `node scripts/run-node-tests.mjs src/domain/sceneDataset.test.ts src/domain/sceneMetricSummary.test.ts src/data/sensorTrendGenerator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSceneStats.ts src/hooks/useSensorTrend.ts
git commit -m "refactor: derive scene hooks from canonical dataset"
```

### Task 5: Document, index, and track the new data architecture execution

**Files:**
- Modify: `docs/README.md`
- Modify: `progress.md`
- Modify: `findings.md`
- Modify: `task_plan.md`

- [ ] **Step 1: Ensure plan/spec are both indexed**

```md
| P3 | [superpowers/plans/2026-06-14-hive-90-data-pipeline-plan.md](./superpowers/plans/2026-06-14-hive-90-data-pipeline-plan.md) | 90+ 数据底座实施计划 | 2026-06-14 |
```

- [ ] **Step 2: Record execution decisions in progress/findings/task plan**

```md
- Canonical scene dataset introduced as the only mock truth source for fractures, robots, alerts, and scene summaries.
- API normalizers added to tolerate future field, enum, and unit drift from engineering teams.
```

- [ ] **Step 3: Verify docs are consistent**

Run: `rg "hive-90-data-pipeline-plan|hive-90-data-pipeline-design" docs README.md task_plan.md findings.md progress.md`
Expected: references found in docs index and planning files.

- [ ] **Step 4: Commit**

```bash
git add docs/README.md task_plan.md findings.md progress.md docs/superpowers/plans/2026-06-14-hive-90-data-pipeline-plan.md
git commit -m "docs: add 90+ data pipeline implementation plan"
```

### Task 6: Full verification and browser regression pass

**Files:**
- Verify: `src/domain/sceneDataset.ts`
- Verify: `src/api/normalizers.ts`
- Verify: key browser flows at `http://127.0.0.1:5173/`

- [ ] **Step 1: Run the focused automated suite**

Run:

```bash
node scripts/run-node-tests.mjs \
  src/domain/sceneDataset.test.ts \
  src/api/normalizers.test.ts \
  src/domain/sceneMetricSummary.test.ts \
  src/lib/sceneSemantics.test.ts \
  src/data/sensorTrendGenerator.test.ts \
  src/data/robotDataGenerator.scenario.test.ts \
  src/data/alertDataGenerator.scenario.test.ts
```

Expected: PASS

- [ ] **Step 2: Run lint and build verification**

Run:

```bash
npm run lint
npm run build:check
```

Expected: both PASS

- [ ] **Step 3: Run browser regression checks**

Verify:
- 3D camera rotates in active scene
- scenario switch updates scene label, left metrics, trends, and alert semantics
- clicking robots/fractures/channels updates right-side detail
- English toggle changes visible UI copy in at least header/panel/action surfaces

- [ ] **Step 4: Update progress with final verification results**

```md
- Automated tests/lint/build passed.
- Browser regression pass completed for camera, scenario switch, detail linkage, and language switch.
```

- [ ] **Step 5: Commit**

```bash
git add progress.md
git commit -m "test: verify canonical data pipeline integration"
```
