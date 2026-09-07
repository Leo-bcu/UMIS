# A2 Light Graphite UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dark HUD visual language with the approved A2 Light Graphite Industrial Workbench direction.

**Architecture:** Keep the current React component structure and domain behavior. Change the design system tokens first, then update global layout surfaces, core panels, cards, chat/export surfaces, and 3D overlay styling so the app reads as a light graphite workbench around a dark 3D canvas.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand, existing shadcn/Radix primitives.

---

## File Map

- `src/index.css`: global color tokens, body font, scrollbars, shared utility classes.
- `tailwind.config.js`: Tailwind color/font tokens aligned to A2.
- `src/components/ui/card.tsx`, `button.tsx`, `badge.tsx`: base component surfaces.
- `src/components/layout/TopBar.tsx`, `MainLayout.tsx`, `ComplianceBar.tsx`, `ExportHub.tsx`: product shell and export modal.
- `src/components/control-panel/*.tsx`, `src/components/findings/*.tsx`: left workbench panels and Finding cards.
- `src/components/scene/*.tsx`: floating overlays, detail panel, measurement labels, camera info.
- `src/components/chat/*.tsx`: bottom AI assistant surface.

## Tasks

### Task 1: Design Tokens

- [ ] Replace global dark HUD tokens with A2 tokens: `background=#EEF2F6`, `background-secondary=#F8FAFC`, `background-tertiary=#FFFFFF`, `background-panel=#E5EAF1`, `primary-yellow=#C99A2E`, `primary-blue=#1F2937`, text dark.
- [ ] Change default font stack to Inter / Noto Sans SC / system and keep JetBrains Mono for data.
- [ ] Update `.glass-panel`, scrollbar, grid background, and selection helpers to light graphite surfaces.

### Task 2: Shell Layout

- [ ] Make TopBar white/light graphite, remove the remaining HUD feel, keep the export action as dark primary.
- [ ] Make left/right rails light workbench surfaces with subtle borders.
- [ ] Keep central 3D canvas dark.
- [ ] Convert compliance bar from red alarm strip to restrained compliance text with red accent only.

### Task 3: Panels And Cards

- [ ] Update base Card/Button/Badge styling to A2.
- [ ] Update control panel cards, role dashboard, mission snapshot, findings, audit, robot/fleet/sensor panels to light cards.
- [ ] Use red/amber/green only for status text, small badges, bars.

### Task 4: 3D Overlays And Detail Surfaces

- [ ] Convert camera info, measurement popovers, selected object details, robot detail dialog, and overlay labels to white/light cards over dark 3D.
- [ ] Reduce yellow-heavy labels; use dark text, red for danger, green for measured/safe, amber for review.

### Task 5: Chat And Export

- [ ] Convert ChatPanel to a white/light workbench assistant surface.
- [ ] Keep AI status, audit, and evidence chips visible but restrained.
- [ ] Convert ExportHub modal to white Package Center style, keeping dark primary action.

### Task 6: Verification

- [ ] Run focused tests for existing domain/store changes.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build:check`.
- [ ] Attempt local visual check using currently available browser/file access; if blocked, record the exact limitation and rely on screenshots/mockup plus build checks.
