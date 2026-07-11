# Life OS – Training Tab PRD

## Problem statement
Build a premium, dark, minimal Training tab inside the existing Life OS dashboard. Focused on workout tracking, training history, progression, programs, bench strength — no recovery score, health metrics, exercise library, or workout suggestions. Uses the existing app dock (no second dock). Internal segmented navigation.

## Architecture
- Single-file dashboard app served from `/app/frontend/public/index.html` (via CRA dev server).
- Training tab implemented as a self-contained module in `/app/frontend/public/training.js` (IIFE, exposes `window.Training`).
- Storage: `localStorage` only (keys prefixed `tr_`). No backend calls, ready for future health/AI expansion.
- Data models: programs (weekly split), workouts (history), current (in-progress workout), photos (front/side/back per day), weights (bodyweight log), benchTips, goals.

## Design tokens (Training-scoped)
- Accent: `#5eead4` (calm cyan/mint)
- Surfaces: `#0f1012`, `#141518`, `#17191d`
- Text: `#FAFAFA`, `#9c9a94`, `#6b6a65`
- Radii: 20px cards, 100px pill buttons/tabs
- Subtle borders (no side-only borders), soft radial gradient lighting
- Body map SVG shaded by training volume per part

## Implemented features (Jan 2026)
- **Home**: bold title, day/date, 7-day date scrubber, next workout hero, Explore sub-nav cards, upcoming sessions list, recently completed list
- **Workouts**: start empty / start from plan, add/remove exercises, per-set weight+reps+done, remove sets, previous-session comparison + progressive overload delta, discard/finish flow, PR toast
- **Progress**: total workouts, week volume, progress photos (front/side/back, local file → base64), bodyweight log modal, body strength map SVG (10 regions, 5 intensity levels), PR list, per-exercise strength trend line chart, goals with progress bars
- **Programs**: 7-day weekly split, per-day name, per-day exercise list add/remove, toggle rest day
- **Bench**: 1RM hero, bench progression line chart, bench log (last 8 sessions), custom tips/notes with add/remove
- **Calendar**: total sessions, current streak (rest days don't break), monthly count, 52-week heatmap (rest / trained / today), full history list, tap-a-day → workout modal
- **Interaction**: pill segmented tabs, sub-nav card jump, modal (photo, weight log, goal, workout view/delete), toast, smooth animations
- **Sidebar**: renamed "Fitness" → "Training" under HEALTH section, uses cyan dot

## Files
- `/app/frontend/public/index.html` — main app (Training page container added, sidebar nav updated, showPage hook, CSS injected)
- `/app/frontend/public/training.js` — Training module (all logic + charts + body map)
- `/app/frontend/src/index.js` — no-op (React bundle not used)

## Deferred / Future (not yet built)
- Backlog / P1
  - Weight unit toggle (kg/lb) in UI
  - Rest timer between sets
  - Set-level RPE / notes
  - Export workouts to CSV/JSON
  - Cloud sync to MongoDB when auth exists
- P2 / later per problem statement
  - Exercise library (deferred by request)
  - Workout suggestions & recovery score (deferred until health data section exists)
  - Health metrics integration (Apple Health / Google Fit)
  - AI form check or coaching layer

## Next action items
- User adds their own weekly split in Programs, then starts logging.
- Iterate on UX after real usage.
