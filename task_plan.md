# HIVE 90+ Product Development Plan

Goal: Continue HIVE from the completed Phase 1 safety cognition MVP toward a 90+ international industrial-grade product.

## Phases

| Phase | Status | Notes |
| --- | --- | --- |
| 0. Clear residual technical debt | complete | `npm run lint` is 0/0, Vite build has no warnings, main app chunk is ~280 kB, export/report/3D vendors are split, generated Python cache artifacts were removed. |
| 1. Commercial role dashboards | complete | Added role dashboard domain summary and control-panel tabs for Manager, Safety, Engineer data quality, and Mission Timeline. |
| 2. AI governed interaction | complete | Added AI action policy, audit log, unsafe threshold blocking, and visible AI action audit panel. |
| 3. CAD-ready export workflow | complete | Added export preflight domain checks, visible preflight controls for AI inferred boundaries, and export history records. |
| 4. International industrial polish | complete | Added i18n/role selector, permission-gated export, project/mission snapshot panel, AI undo affordance, and removed production debug logs. |
| 5. Final verification | complete | 23 domain/store tests passed, lint passed, TypeScript/Vite build passed, backend compile passed, static dist asset smoke passed. Browser/preview server smoke was blocked by sandbox EPERM/approval service 503. |

## Current Priorities

1. Rebuild HIVE around a unified raw-mock-to-derived-data pipeline instead of hand-filled panel outputs.
2. Make API ingestion tolerant to field drift, enum drift, unit drift, missing fields, and mixed-quality inputs.
3. Keep every new workflow tied to evidence, coverage, review queues, export readiness, and documented acceptance criteria.
4. Close the remaining demo-grade interaction gaps so the live conference/demo surface feels commercially credible, not just semantically correct.
5. Current P0 execution plan is indexed at `docs/superpowers/plans/2026-06-15-hive-90-p0-readiness-plan.md`; P0 gates are complete, and P1 dense-target disambiguation has shipped.

## Product Decisions

- HIVE stays a lightweight unknown-space safety cognition and delivery workbench, not a heavy digital twin platform.
- AI must improve interaction and explanation, but safety conclusions require evidence, truth boundaries, and human/field verification.
- Heavy CAD/GIS/point-cloud analysis remains outside HIVE; HIVE prepares clean, bounded, exportable evidence packages.
- Every new product module must update docs/indexes and include focused verification.
- Mock strategy is now source-first: mock raw observations, telemetry, events, and analysis outputs; never hand-maintain final dashboard numbers as the primary truth source.
- API contracts must be adaptable rather than rigid. Future engineering data may differ in naming, units, optionality, or quality, so adapters must normalize and degrade safely.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Browser plugin rejected `http://127.0.0.1:5173/` | 1 | Do not bypass; use build/lint/unit tests plus local HTTP smoke unless browser policy changes. |
| Vite preview server listen `EPERM` and escalation review returned 503 | 1 | Did not bypass; used production build plus static `dist/index.html` asset-reference smoke instead. |
| Python compile regenerated `backend/__pycache__` and escalation review returned 503 for cleanup | 1 | Did not bypass. Generated cache directories remain and should be removed by the user or next approved cleanup. |
| Browser automation against user-visible local tabs mixed stale state with the current dev instance | 1 | Switched verification to the controlled `http://127.0.0.1:5175/` instance and used DOM/code/HTTP cross-checks before treating any browser symptom as a product bug. |
| `ScenarioSelector` helper export used for localization verification reintroduced Fast Refresh lint warnings | 1 | Moved shared copy helpers into `src/lib/scenarioSelectorCopy.ts` and re-ran lint/test/build to restore a clean gate. |
| In-app browser execution context exposes limited DOM methods (`click`, `dispatchEvent`, `MouseEvent`, injected store globals) compared with normal Chromium | 1 | Treated it as an automation-environment limitation, not a product blocker. Added hidden `dev-state` beacon plus right-rail test ids so browser-grade verification can rely on DOM state markers instead of fragile injected click APIs. |
| Browser-wide `document.body.textContent` or broad selector sampling can mix stale/hidden content and create false scene-semantic regressions | 1 | Switched browser checks to stable per-element hooks (`dev-state`, `detail-panel-*`, `robot-card-task-*`) and treated broad full-body scraping as advisory only. |

## Remaining 90+ Gaps

1. Continue commercial polish in the workbench:
   - visually separate title and status chips in snapshots where OCR/text extraction still reads them as glued together
   - improve right-rail empty/detail-state hierarchy so object selection feedback is more obvious on first glance
   - review any remaining late-rendered helper copy that still depends on component-local strings
2. Continue migrating any remaining panel aggregates toward source-derived calculations where a card may still lean on hand-shaped summary numbers.
3. External-decision items not safe to fake-complete: full enterprise auth/team collaboration, real hardware data onboarding, advanced CAD/GIS round-trip beyond current export readiness, and rich asset maintenance history.
