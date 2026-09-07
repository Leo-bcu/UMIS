# Coal Mine Vertical Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the coal mine demo from a flattened horizontal network into a physically plausible vertical cutaway with surface entry, inclined shaft, upper roadway, middle working face, deep goaf, drainage chamber, roof fissures, and robot paths descending through the mine.

**Architecture:** Keep the existing dashboard and scene components. Change coal raw topology data in `src/data/fractureDataGenerator.ts`, strengthen topology tests in `src/data/coalMineTopology.test.ts`, and adjust coal-only background cues in `src/components/scene/ScenarioStructureLayer.tsx` so the 3D scene reads as a vertical mine section rather than a flat map.

**Tech Stack:** TypeScript, React, Three.js, Node test runner, Vite.

---

### Task 1: Encode Real Vertical Coal Topology

**Files:**
- Modify: `src/data/fractureDataGenerator.ts`
- Test: `src/data/coalMineTopology.test.ts`

- [ ] Add depth assertions: coal path points must span at least 60 units on Y, contain surface points above 12, contain deep points below -45, and have at least three depth bands with mining object names mapped to the right bands.
- [ ] Rewrite `generateCoalWorkings()` path arrays so they form a vertical cutaway: surface portal -> inclined shaft -> upper haulage -> middle working face -> deep goaf/drainage/seal branches.
- [ ] Keep robot path points derived from the same arrays, so robot deployment remains raw-data-driven.
- [ ] Run `npm test -- src/data/coalMineTopology.test.ts` or the project test command if scoped args are unsupported.

### Task 2: Adjust Coal Scene Background To Match Cutaway

**Files:**
- Modify: `src/components/scene/ScenarioStructureLayer.tsx`
- Test: visual browser screenshot and `npm run build:check`

- [ ] Replace the shallow wide rock block cues with a taller vertical rock slice and a thinner surface cap.
- [ ] Move support posts/hazard markers to the new vertical bands.
- [ ] Do not add wireframe spheres, debug boxes, floating planets, or large decorative markers.
- [ ] Keep interactions and selectable objects owned by `FractureNetwork`, not duplicate them in the background layer.

### Task 3: Verify, Commit, Push

**Files:**
- Verify only unless fixing failures.

- [ ] Run `npm test`.
- [ ] Run `npm run build:check`.
- [ ] Open/reload coal scene in the in-app browser and visually confirm the middle 3D area is a vertical mine cutaway.
- [ ] Commit changed files only, excluding unrelated `docs/demo-video-script-coal.md`.
- [ ] Push `main`.
