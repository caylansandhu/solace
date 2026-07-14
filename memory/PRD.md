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
- **Dashboard rewrite**: removed 11 legacy widgets (day streak, greeting widget, quick actions, clock, today widget, spotify, focus/pomo, mood, weight trend, calendar, standalone weather). New home order:
  1. **Today's Command Centre** — accent-colored eyebrow, time-based greeting ("Good morning/afternoon/evening, {name}"), `HH:MM Weekday, DD Month` time+date, small weather chip, live alerts list (open goals, tasks, today's events → tap navigates)
  2. **Daily Briefing** — expandable card, Groq prompt now generates 3 labelled sections (YESTERDAY / TODAY / NEWS covering politics/sports/finance) under 90 words
  3. **Tasks** — clean card with progress ring + fraction + remaining count
  4. **Status** — pages / minutes / connections snapshot
  Old widget nodes retained hidden (aria-hidden, display:none) so legacy interval code (pomo/spotify/weather/mood) keeps operating without null-error explosions.
- **Training Programs → Targets**: "Training Targets" renamed to just "Targets"; per-muscle sets/reps rows removed; replaced with two global inputs "Sets" (large numeric) then "Reps" (large numeric) that apply to all exercises. New localStorage key `tr_global_target_v1`. Split card and Targets card now `align-items:start` so they line up at the same top height on desktop.
- **Year heatmap missed days**: empty (non-workout, non-rest, non-future) days now render a subtle "×" glyph instead of a blank cell; legend now includes "Missed" cell.

## Files
- `/app/frontend/public/index.html` — main app (sidebar nav, CSS, accent system, lock screen, Settings)
- `/app/frontend/public/training.js` — Training module (~1400 lines, IIFE)
- `/app/frontend/src/index.js` — no-op (React bundle unused)

## Deferred / Future
- P1: Weight unit toggle (kg/lb), rest timer between sets, set-level RPE/notes, CSV/JSON export
- P2: Backend sync (auth + MongoDB), exercise library, workout suggestions, recovery score, health API integration, AI coaching layer, PWA/installable web app

## Test credentials
Not applicable — no auth/backend. Face ID registration is device-local (WebAuthn platform authenticator).
