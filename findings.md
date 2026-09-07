# Project Recon Findings

## Root Snapshot

- Workspace: `/Volumes/HD/robot`
- Initial root inventory shows a Vite/React-style frontend project with `src/`, `public/`, `backend/`, `dist/`, `docs/`, `package.json`, `vite.config.ts`, Tailwind/PostCSS/ESLint/TypeScript configs, Vercel config, screenshots, and YAML browser snapshots.
- Existing docs discovered at root: `README.md`, `API_CONTRACT.md`.
- Evidence artifacts include many `test-*.png`, `*-snapshot.yaml`-style files, and `test-screenshots/`.

## Product And Docs

- Product name: HIVE — 群智数字孪生主控舱.
- Positioning: underground engineering digital twin cockpit for coal mines, gold mines, oil/gas, and later industrial scenes such as pipeline, nuclear, refinery, underground flow.
- Primary value propositions: 3D scene rendering, Potree large-scale point cloud, deck.gl sensor heatmap, 200+ robot fleet status, LLM-assisted decision making with scene actions, measurement/annotation tools, WebSocket realtime updates.
- `docs/README.md` is the standard index and marks mandatory docs: color standard, export standard, API contract, AI prompt standard.
- `docs/DATA_FORMAT.md` states current data is 100% mock by default, with `.env` toggling to live API mode.
- `docs/UX_AUDIT_REPORT.md` records a product audit across mine owner, surveying engineer, and nuclear maintenance worker roles. It lists critical UX issues and a later 2026-06-13 fix log for many P0/P1 items.
- `docs/UI_ITERATION_REPORT.md` uses Cesium, Palantir Foundry, and DJI FlightHub 2 as references for underground transparency/depth, telemetry density, and industrial HUD labels.
- `docs/EXPORT_STANDARD.md` defines PDF, LAS 1.4, OBJ+MTL, and CSV compliance expectations.
- `docs/AI_PROMPT_STANDARD.md` defines a shared AI prompt architecture with common abilities, scene prompts, common answer rules, and anti-hallucination rules.

## Technical Stack

- Frontend: React 18, TypeScript, Vite, Tailwind, Radix UI, Zustand.
- 3D/visualization: Three.js, React Three Fiber, drei, Potree 1.8, deck.gl.
- Export/reporting: html2canvas, jsPDF, custom LAS/OBJ/CSV exporters.
- Backend: FastAPI + Open3D processor skeleton, optional in current setup.

## Source Architecture

- `src/App.tsx` composes the whole app: mobile warning, `MainLayout`, left `ControlPanel`, central `Scene3DCanvas`, bottom `ChatPanel`, `WatermarkOverlay`, and `RobotDetailDialog`.
- `src/components/layout/MainLayout.tsx` implements the fixed cockpit layout: top bar, left console, central 3D scene + chat, right detail panel, bottom compliance bar.
- `src/components/layout/ScenarioSelector.tsx` exposes 5 data sources: underground fracture, pipeline, nuclear reactor, refinery, underground flow. The fracture data source has 3 sub-scenarios: coal, gold, oil.
- `src/store/useSceneStore.ts` is the global UI/domain state hub: layers, thresholds, physical truth mode, camera target, highlights, messages, selected robot/fracture/node, annotations, AI markers, alert acknowledgement, and playback state.
- `src/components/scene/Scene3DCanvas.tsx` mounts the R3F canvas and composes RockMass, ReactorContainment, FractureNetwork, DeckGlHeatmap, Potree camera sync/viewer, robot markers, POIs, AI markers, measurement tools, annotation overlay, playback engine, camera tracker, and orbit controls.
- `src/components/chat/ChatPanel.tsx` streams AI responses, injects scene context, handles errors, and executes returned scene actions.
- `src/api/` is the mock/live boundary. APIs import mock generators only in mock mode and otherwise call `httpClient`.
- `backend/main.py` provides FastAPI endpoints for fractures, scene nodes/geometry/stats, robots, POIs, alerts, health, point-cloud processing, ICP registration, fracture reconstruction, SLAM pose, coordinate transform, and Potree conversion.

## Current Progress

- UX audit says 5 critical issues, 10 major issues, and 1 medium issue were fixed on 2026-06-13.
- Documented remaining work: M7 new-user onboarding and ME1-ME15 medium UX enhancements.
- Screenshot artifacts and test snapshots exist for initial state, AI commands, robot focus, sensor regions, pipeline/nuclear/refinery scenes, and QA verification.
- Code search confirms current source removed the old bottom developer tags in `Scene3DCanvas` and uses `● LIVE`; older screenshots still show pre-fix technical labels, so screenshots are not all current.

## Risks / Mismatches

- Backend robot status vocabulary is inconsistent with frontend: backend/data provider uses `active/idle/charging/warning/error`, while frontend types/mock use `online/offline/low_battery/error/maintenance`.
- Backend alert levels include `critical` in Python data provider/README examples, while frontend alert type is `danger/warning/info`.
- `docs/DATA_FORMAT.md` says current status is 100% mock; backend exists but should be treated as optional/demo fallback until live mode is tested end-to-end.
- Mandatory color standard forbids hardcoded scene colors, but scene components still contain some literal hex values in inspected files; this may be deliberate legacy or a PR-review gap.
- This reconnaissance did not run a fresh `npm run build`; the UX document claims a prior build passed.

## 2026-06-13 Full Audit Findings

- `npm run build` passes, but Vite reports large main chunk (~1.98 MB minified / ~597 KB gzip) and mixed static/dynamic imports limiting code splitting.
- `npm run build:check` fails at `tsc -b` with TypeScript errors across layer config, trends, export data typing, R3F element typing, sensor indexing, scenario coverage, tuple spreads, and PDF helper typing.
- `npm run lint` fails with 107 errors / 34 warnings. A major root cause is ESLint scanning vendored/generated `public/potree` and `public/pointclouds`; source also has real lint issues, including conditional React hooks in `RobotMarkers.tsx`.
- `python3 -m compileall backend` passes.
- Confirmed contract drift: backend robot and alert schemas do not match frontend TypeScript types.

## 2026-06-13 Fixes Applied

- Fixed TypeScript compile failures and restored `npm run build:check`.
- Scoped ESLint away from vendored/public point-cloud assets and changed `no-explicit-any` to a warning so historical Potree/Three integration debt remains visible without blocking CI.
- Fixed real lint blockers: conditional React Hooks in `RobotMarkers.tsx`, empty catch blocks, unused imports/variables/functions, stale helper values, and scene/store dead code.
- Fixed Python live-contract drift:
  - Robot IDs/models/statuses/mesh roles now match frontend `Robot` types.
  - Robot stats now return `online/offline/lowBattery/error/maintenance/meshConnected/avgBattery`.
  - Alerts now use `danger/warning/info`, include `type` and `acknowledged`.
  - Fracture nodes now include `timestamp` and `robotId`; `connectivity` is numeric.
- Current verified state:
  - `npm run lint`: passes with 0 errors and 61 warnings.
  - `npm run build:check`: passes, with Vite chunk/import warnings.
  - `python3 -m compileall backend`: passes.
  - Python generator smoke check confirms robot/alert/fracture node keys match the frontend contract.

## Remaining Technical Debt

- 2026-06-14 update: the previous 61 ESLint warnings were resolved; lint now reports 0 errors and 0 warnings.
- 2026-06-14 update: the previous Vite large main chunk / mixed import warnings were resolved. The main app chunk is now ~279.63 kB, while 3D/report vendors are split into separate chunks.
- Python `__pycache__` artifacts were removed after backend compile checks.

## 2026-06-14 Scene-Semantic Audit Findings

- Confirmed the user's underground-flow issue was systemic, not isolated to `SensorTrends`: several panels still used coal/fracture-era labels or thresholds while the active data source was underground flow.
- `SensorTrends` previously reused hardcoded region and metric concepts, so underground flow could display fracture-zone copy and CH4-shaped assumptions. It now derives region naming, labels, units, thresholds, and fallback values from scene semantics and aggregates from raw mock sensor readings.
- Underground mock data previously reused small rock-fracture permeability magnitudes that did not match the UI threshold or hydrology story. The generator now emits karst/pressurized-channel-scale permeability values.
- `SystemStatus`, `GasThresholdSlider`, export descriptions, PDF/CSV content, layer labels, measurement tools, and right panel titles had scene-specific gaps. These are now wired to a shared scene semantics layer.
- The AI mock assistant had a branch-order bug: "水压异常" was captured by the generic "异常/最危险" path and "地温梯度" could fall into generic fracture temperature wording. Underground hydrology requests now route before generic pressure/temperature/gas branches.
- Right-side detail for selected underground channels previously fell through to oil/reservoir-style metrics. It now shows underground-channel risk bars and auxiliary values: permeability, water pressure, ground temperature, H2S, pH, mineralization estimate, water saturation, and channel geometry.
- Regression coverage was added to keep underground flow copy away from fracture/gas defaults and to verify the displayed values are computed from raw mock readings.

## Phase 1 Safety Cognition Progress

- Added `Finding` / `FindingEvidence` / `TruthBoundary` domain objects, runtime schemas, and conversion helpers for alerts and AI markers.
- Control panel now has a lightweight `Exploration Coverage` card that separates measured path sampling, unknown sampling positions, AI-inferred findings, low-confidence review items, and human-verified findings.
- `Truth Boundary` is now visible in the product surface with explicit labels: measured, interpolated, AI inferred, unknown, and human verified.
- AI `markPoints` actions now create both 3D markers and auditable Findings, so natural-language analysis is no longer only a visual pin.
- Manual annotations can now be explicitly promoted to human-verified Findings.
- PDF export now includes a `风险发现与可信边界` section so Findings are present in the management/reporting deliverable.
- This is intentionally a safety cognition MVP, not a full industrial coverage mesh. The current summary is honest to available data: fracture paths, sampled nodes, and Finding boundaries.

## 90+ Roadmap Implementation Progress

- Role dashboards now make HIVE closer to Flyability/DroneDeploy/GroundHog commercial panels: management sees risk/coverage/export readiness, safety sees a review queue, engineering sees data quality, and mission timeline is visible.
- AI interaction now has a policy gate, audit trail, human-review flags, unsafe threshold blocking, and practical undo affordance for reversible actions.
- Export workflow now has preflight checks, AI inferred boundary controls, lazy-loaded exporters, and export history so delivery is traceable instead of a one-off button.
- International polish now includes a lightweight role selector, language toggle, mission delivery snapshot, and export permission gating.
- Remaining product gap is depth rather than skeleton: future work should harden real data ingestion, collaborative sharing, enterprise auth, and richer CAD/GIS layer schemas after real device constraints are confirmed.

## Product Research Synthesis

- Cesium direction: mature geospatial digital twins emphasize 3D Tiles streaming, clipping/underground inspection, and temporal/geospatial context. HIVE already has scene layers but can add a clearer spatial slicing and time-state model.
- ArcGIS direction: scene-centric workflows prioritize layer lists, elevation/underground controls, popups, measurements, and web-scene sharing. HIVE can improve operator trust by making layer state, view bookmarks, and saved inspection scenes first-class.
- Bentley iTwin direction: infrastructure twins are asset-centric, connecting reality data, engineering data, and IoT/sensor data to named assets. HIVE should graduate from anonymous fractures/pipes to asset objects with history, ownership, maintenance state, and evidence.
- DJI FlightHub 2 direction: field operations emphasize live mapping, team annotations, media/task management, and shared command-room situational awareness. HIVE's AI markers and annotations can become collaborative incident/task objects.
- Palantir AIP/Foundry direction: operational AI works through ontology/actions: the model can reason over entities and execute governed workflows. HIVE already has "言出法随" scene actions; the upgrade is an explicit action registry with permissions, audit trail, and undo.

## Refined Comparable Product Research

User correction: HIVE should not become a heavy industrial digital twin. The commercial target is closer to "unknown-space safety cognition + reality capture + AI interaction + export to heavy tools".

- Flyability Elios 3 / Inspector pattern: sell "digitizing the inaccessible", real-time 3D live map, inspection coverage, simple 3D reporting, return-to-signal safety, and dedicated sensor payloads. Lesson: cockpit should privilege safety, coverage, operator confidence, and inspection report handoff over generic enterprise twin breadth.
- DroneDeploy pattern: sell a timestamped visual record, remote visibility, issue pinning, proof for disputes/RFIs, hardware-agnostic capture, and integrations. Lesson: HIVE should make "what was seen, when, where, by whom, with what confidence" a first-class evidence trail.
- NavVis IVION pattern: browser-based shared reality capture that non-specialists can access, understand, and act on; specialists still use BIM/CAD integrations. Lesson: HIVE should stay lightweight in-browser while exporting cleanly to CAD/analysis tools.
- PIX4Dsurvey pattern: bridge capture and CAD; simplify point clouds into CAD-ready vectors/layers instead of replacing CAD/GIS. Lesson: HIVE exports should become a guided "send to heavy tool" workflow with validation, layers, and explainable simplification.
- GroundHog Apps pattern: commercial mining panels emphasize real-time visibility, fleet/RTLS, safety, role-based workflows, quick deployment, ROI, and ease of training. Lesson: HIVE's paid value should be framed around faster safe decisions and less expert workload, not raw rendering sophistication.

Refined upgrade principle: add stronger AI interaction, truth boundaries, confidence/evidence controls, and simple commercial workflows before adding more industrial-platform modules.

## Open Questions

- Which screenshot set should be considered canonical after the 2026-06-13 fixes?
- Should the backend be made contract-strict now, or remain a loose demo service until real data integration starts?
- Should the 5-source demo framing replace the older README statement that only highlights three geological scenarios?

## 2026-06-14 Data-Architecture Direction

- User confirmed the core correction: mock should simulate raw input data and intermediate analysis, not manually maintained dashboard outputs.
- New hard requirement: interface handling must be resilient to real engineering data differences in naming, quality, units, completeness, and schema style.
- Planning/process requirement: all design/plan/progress documents must be persisted to files and indexed so future sessions do not duplicate research or planning.
- Design conclusion: HIVE should use a layered model of raw mock data -> adapter/normalization -> scene semantics -> derived metrics -> UI/export/AI.

## 2026-06-14 Implementation Findings

- The biggest data-consistency win came from introducing a canonical scene dataset rather than continuing to let `scene stats`, `robots`, and `alerts` each generate from separate assumptions.
- The remaining most visible UX risk is no longer scene wording drift; it is 3D object selection stability. Right-side details exist and render, but selection still needs stronger interaction guarantees to feel commercial-grade.
- Vite still reports a non-failing dynamic-import/chunking warning around `sceneDataset.ts` because mock APIs lazy-import it while `useSceneStats` also statically imports it. This is not a functional failure, but it remains technical debt if we want a perfectly clean build report.
