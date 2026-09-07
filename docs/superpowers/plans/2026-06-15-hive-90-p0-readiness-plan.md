# HIVE 90+ P0 Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the demo-critical HIVE surface above the 90-point threshold by eliminating P0 risks that would undermine a customer or academic conference demonstration.

**Architecture:** Keep HIVE lightweight: source-first mock data flows through tolerant adapters into derived scene datasets, then into scene-specific UI, governed AI actions, export readiness, and browser-verifiable interactions. Do not add heavy industrial digital-twin modules; focus on trust, consistency, and operability.

**Tech Stack:** React 18, TypeScript, Zustand, Vite, React Three Fiber, Three.js, Node test runner, ESLint, Vite build, Playwright-based UI regression script.

---

## P0 Definition

P0 here means: if it fails during a live demo, users will reasonably conclude the product is a toy, fake shell, or unsafe decision surface.

Non-P0 items are intentionally excluded: collaborative enterprise workflow, advanced CAD/GIS semantics, full auth, long-term dashboard expansion, and deep industrial analysis that belongs in exported heavy tools.

## P0 Work Table

| ID | P0 Area | Problem To Eliminate | Planned Fix | Acceptance Standard |
| --- | --- | --- | --- | --- |
| P0-1 | Source-first data truth | Panels may still display numbers that are not traceably derived from raw mock observations. | Add a data lineage audit across scenario stats, robot fleet, alerts, trends, coverage, and export readiness; move any remaining hand-maintained aggregates behind derived functions. | Unit tests prove key counts/rates/risk summaries are derived from one canonical dataset per scene; no impossible counts such as more sampled points than deployed robots/data nodes. |
| P0-2 | API tolerance | Real engineering feeds may use different names, units, missing fields, arrays, or enum values. | Expand normalizer tests and adapter behavior for robot, scene stat, alert, fracture/channel, POI, and telemetry inputs; preserve safe defaults and quality flags. | Mixed-shape fixture tests pass; broken optional fields degrade visibly but do not crash or create false precision. |
| P0-3 | Scene semantic consistency | A scene can still leak another scene's vocabulary, thresholds, layer names, or parameter labels in late-rendered panels. | Build a scenario-semantic audit matrix and cover visible panels for `coal/gold/oil/pipeline/nuclear/refinery/underground` in Chinese and English. | Browser regression fails if underground shows fracture/CH4 copy, nuclear shows geological layer copy, or pipeline/refinery copy appears in the wrong scene. |
| P0-4 | 3D picking and right-rail handoff | Dense 3D targets can overlap; click result can feel wrong or unclear. | Add an explicit overlap handling policy: nearest robot for robot body clicks, exact node/path for measurement targets, and a fallback disambiguation affordance or stable test note where independent target is impossible. | Automated 3D target regression passes across all scenes; manual click on a visible robot or channel opens the matching right panel without freezing orbit controls. |
| P0-5 | Tool workflow reliability | Measure/profile/area/text tools must not feel awkward, hidden, or impossible to recover from. | Verify every tool has clear entry, active instruction, confirm/reselect/cancel/exit behavior, localized labels, and non-obstructive visuals. | Browser regression covers activation and exit/reselect flows for F1-F4 in representative scenes; no oversized artifacts block the scene. |
| P0-6 | Demonstration deployment | A pushed build must be deployable and reproducible, with clean local and remote gates. | Keep `npm test`, `npm run lint`, `npm run build:check`, and `scripts/ui-regression.mjs` as required gates; document exact latest verification in `progress.md`. | All gates pass locally; GitHub Pages deploy succeeds; worktree clean after commit/push. |

## Execution Tasks

### Task 1: Audit Remaining Source-Truth Gaps

**Files:**
- Inspect/Modify: `src/domain/sceneDataset.ts`
- Inspect: `src/data/*Generator*.ts`
- Modify: `src/domain/sceneDataset.test.ts`
- Inspect: `src/domain/sceneMetricSummary.test.ts`

- [x] Find displayed aggregate values that are not clearly derived from canonical scene data.
- [x] Replace fixed `avgConf` display value with source-derived data confidence.
- [x] Add tests preventing impossible node/robot/alert totals across all scenarios.
- [x] Run focused scene dataset tests.

### Task 2: Harden API Normalizers Against Real Feed Drift

**Files:**
- Modify: `src/api/normalizers.ts`
- Modify: `src/api/normalizers.test.ts`
- Inspect: `src/api/*.ts`

- [x] Add mixed engineering feed fixtures for alternate field names, numeric strings, percent-like values, object geometry, and inconsistent totals.
- [x] Ensure normalized records clamp impossible counts and do not invent high-confidence values.
- [x] Run `node scripts/run-node-tests.mjs src/api/normalizers.test.ts`.
- [x] Run `npm test`.

### Task 3: Expand Scene-Semantic Browser Regression

**Files:**
- Modify: `scripts/ui-regression.mjs`
- Modify/add tests under `src/lib/*scene*test.ts` if semantic helpers need coverage.

- [x] Add a scenario-language matrix for `coal`, `gold`, `oil`, `pipeline`, `nuclear`, `refinery`, and `underground`.
- [x] Assert each scenario's store state plus visible right panel/trend/layer/tool copy is scene-appropriate.
- [x] Add negative assertions for known historical leaks: underground must not show fracture/CH4 vocabulary; nuclear must not show rock-layer vocabulary; pipeline/refinery must not show coal roof/gas tasks.
- [x] Run `HIVE_UI_BASE_URL=http://127.0.0.1:5177/ node scripts/ui-regression.mjs`.

### Task 4: Stabilize Dense 3D Object Selection

**Files:**
- Modify: `src/components/scene/Scene3DCanvas.tsx`
- Modify: `src/components/scene/useCanvasInteraction.ts`
- Modify: `src/App.tsx`
- Modify: `scripts/ui-regression.mjs`

- [x] Re-check current picking priority rules against actual visual density in every scene through UI regression.
- [x] If independent node/path clicks are physically impossible in a scene, expose that as a known overlap note instead of silently selecting the wrong object.
- [x] If a visible target is independently clickable, ensure right rail selects the matching robot/fracture/channel.
- [x] Confirm scene switching and direct picking do not break the 3D control loop in browser regression.

### Task 5: Verify Tool Workflows End To End

**Files:**
- Modify only if needed: `src/components/measurement/*`
- Modify: `scripts/ui-regression.mjs`

- [x] Cover distance, area select, text annotation, and profile flows with active instruction/entry checks in browser regression.
- [x] Verify labels and instructions switch between Chinese and English through scenario-language regression.
- [x] Preserve prior smaller measurement visual implementation; no new oversized artifacts introduced.
- [x] Run browser regression.

### Task 6: Final Gate, Docs, Commit, Deploy

**Files:**
- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `docs/README.md` only if a new doc index entry is needed.

- [ ] Record final P0 results and remaining P1/P2 risks in `progress.md`.
- [ ] Update `task_plan.md` so the current P0 status is not ambiguous.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build:check`.
- [x] Run `HIVE_UI_BASE_URL=http://127.0.0.1:5177/ node scripts/ui-regression.mjs`.
- [ ] Commit and push.
- [ ] Confirm GitHub Pages deployment success.

## Stop Conditions

Stop and report only if:

- A P0 gate fails three times with different attempted fixes.
- A required real-data assumption cannot be discovered from code/docs and guessing would create false safety claims.
- The local dev server or remote deploy environment is unavailable after restart and verification fallback is insufficient.

## Expected Remaining Non-P0 After This Plan

- Full enterprise auth and team collaboration.
- Advanced CAD/GIS round-trip beyond current export readiness.
- Rich object-history timeline and maintenance workflow.
- Full enterprise auth, team collaboration, real hardware data onboarding, advanced CAD/GIS round-trip beyond current export readiness, and rich asset maintenance history.
- The polished disambiguation picker for heavily overlapping 3D targets has shipped as the P1 overlap object picker.
