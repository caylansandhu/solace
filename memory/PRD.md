# Life OS – Training Tab PRD

## Problem statement
Build a premium, dark, minimal Training tab inside the existing Life OS dashboard. Mobile-first web app with global accent color, structured Programs (muscle groups + split + training targets), and WebAuthn Face ID lock screen.

## Architecture
- Single-file dashboard app served from `/app/frontend/public/index.html` (via CRA dev server, React bundle no-op).
- Training tab module in `/app/frontend/public/training.js` (self-contained IIFE, `window.Training`).
- Storage: `localStorage` only. Keys prefixed `tr_` for Training, `lifeos_` for global.
- Global accent color system: `applyTheme()` sets `--accent`, `--accent-rgb`, `--accent-soft`, `--accent-glow`, `--accent-15/30/50/70/90` on `:root`. Training + all other pages consume these vars.

## Design tokens
- Accent: user-selectable from 29 premium swatches (8 originals + 21 new including Training cyan `#5eead4`, plus blues/greens/purples/oranges/neutrals)
- Surfaces: `#0f1012`, `#141518`, `#17191d`
- Text: `#FAFAFA`, `#9c9a94`, `#6b6a65`
- Radii: 20px cards, 100px pill buttons/tabs
- Mobile-first: layouts stack on ≤640px, 44px min touch targets, safe-area-inset support

## Implemented features (Jan 2026)

### Training tab (6 sub-tabs via internal pill nav — existing dock untouched)
- **Home**: bold title, day/date, 7-day date scrubber, next workout hero, Explore sub-nav cards, upcoming sessions, recently completed
- **Workouts**: start empty / start from plan, add/remove exercises, per-set weight+reps+done, progressive overload comparison, PR detection toast, finish/discard
- **Progress**: total workouts, week volume, progress photos (front/side/back local base64), bodyweight logger modal, body strength map SVG (10 regions × 5 intensity levels), PRs, per-exercise strength trend line chart, goals with progress bars
- **Programs (v2 — rewritten)**:
  - **Split section** (top-left): 7 days, tap a day → active state → tap muscles below to add chips
  - **Training Targets section** (top-right): per-muscle sets × reps low–high inputs
  - **Muscle Groups list** (below): 9 default (Shoulders, Chest, Biceps, Triceps, Forearms, Abs, Legs, Back, Neck) with press-and-hold drag reorder
  - **Muscle detail view**: tap a muscle → dedicated page with exercise list (add/remove/reorder via drag)
- **Bench**: 1RM hero, progression chart, bench log, custom tips/notes
- **Calendar**: 52-week heatmap, streak (rest-day aware), monthly count, full history, tap-a-day → workout modal

### Global changes (this iteration)
- **Accent color system**: 29 premium swatches, applied globally to every page (toggles, buttons, active states, Training charts, body map, badges). CSS vars derived automatically. Training re-renders charts on accent change.
- **Lock screen (rewritten)**:
  - Removed password/passcode UI completely
  - Removed auto-lock timeout logic entirely
  - Added WebAuthn Face ID / Touch ID registration flow
  - Lock screen defaults to OFF (`lifeos_lock_required=false`)
  - Full-screen layout: "Hello {name}" centered at top, app name centered in middle, big pill unlock button
  - Only appears when Lock toggle is enabled AND Face ID is registered
  - Enabling toggle prompts biometric registration; disabling clears credential
- **Mobile-first**: viewport-meta preserved, min-heights ≥44px, safe-area-inset for iOS notch, stacked layouts on ≤640px, horizontally-scrollable tabs
- **Pre-existing bug fix**: converted `saveGoals`/`saveTasks`/`saveEvents` wrapper pattern from function declarations to function expressions (previously caused Maximum call stack error via hoisting collision)

## Files
- `/app/frontend/public/index.html` — main app (sidebar nav, CSS, accent system, lock screen, Settings)
- `/app/frontend/public/training.js` — Training module (~1400 lines, IIFE)
- `/app/frontend/src/index.js` — no-op (React bundle unused)

## Deferred / Future
- P1: Weight unit toggle (kg/lb), rest timer between sets, set-level RPE/notes, CSV/JSON export
- P2: Backend sync (auth + MongoDB), exercise library, workout suggestions, recovery score, health API integration, AI coaching layer, PWA/installable web app

## Test credentials
Not applicable — no auth/backend. Face ID registration is device-local (WebAuthn platform authenticator).
