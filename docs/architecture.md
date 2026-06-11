# Architecture

## Current Starting Point

The repo is a Vite React PWA with:

- React and TypeScript.
- Dexie/IndexedDB for offline storage.
- Zustand stores.
- A simple SM-2-like scheduler.
- Supabase scaffolding.
- PWA/service worker support.

This is a reasonable base, but the domain model should shift from words/cards to production exercises, scenes, mistakes, and user profiles.

## V1 Architecture Bias

Use a local-first web app with server-side helpers:

- Browser: React app, game UI, offline session state, local queue.
- IndexedDB: local cache of exercises, progress, mistakes, and session logs.
- Netlify Functions: protected API calls, content ingestion, AI correction/generation.
- Netlify Blobs: simple JSON/object storage for generated packs, user mistake snapshots, and cached content where relational querying is not needed.
- Optional database later: Supabase alternative, Neon, Turso, Xata, or another free-tier-friendly backend if querying and multi-user sync outgrow Blobs.

## Why Not Decide The Final Backend Yet

Supabase is already wired, but free-tier pressure means the next step should avoid deeper lock-in until the v1 data shape is clear.

Netlify is already part of deployment, so v1 can use Netlify Functions and Blobs for:

- AI calls.
- User progress snapshots.
- Generated content packs.
- Content ingestion cache.

If collaborative realtime play or richer analytics becomes important, move structured records to a relational backend.

## Authentication

V1 needs multi-user support for at least two learners.

Options:

- Lightweight password-gated household app with local profiles.
- Netlify Identity via `@netlify/identity` for deployed multi-user auth.
- Database-backed auth if the final backend provides it.

Recommendation:

Start with local profiles for immediate UX work, then add deployed auth before storing cloud progress. Do not build a single-user-only model.

## Data Model

Core entities:

- UserProfile.
- Scene.
- Persona.
- Exercise.
- SentenceFrame.
- PhraseChunk.
- MistakeItem.
- ReviewLog.
- Session.
- FluencyMetric.
- ContentSource.
- GeneratedPack.

### UserProfile

- id.
- displayName.
- preferredEnglishVariant: "British".
- targetLevel.
- dailyGoalMinutes.
- privacySettings.
- createdAt.

### Exercise

- id.
- type: chunk | sentence | transform | repair | scene.
- promptEnglish.
- targetItalian.
- alternatives.
- tags.
- level.
- sceneId.
- sourceId.
- srsState.

### Scene

- id.
- title.
- locationType.
- imageAsset.
- levelBand.
- narrativeState.
- availableActions.

### MistakeItem

- id.
- userId.
- promptId.
- answer.
- correction.
- tags.
- explanation.
- repairExerciseIds.
- srsState.
- createdAt.
- lastReviewedAt.

## Netlify Functions

Use modern Netlify Functions with default export plus config.

Likely endpoints:

- `POST /api/evaluate-answer`
- `POST /api/generate-drills`
- `GET /api/content/news`
- `POST /api/content/pack`
- `GET /api/progress/:userId`
- `POST /api/progress/:userId`

Keep all paid API keys server-side. The browser should only call app endpoints.

## Netlify Blobs

Candidate stores:

- `generated-packs`: cached AI-generated scene and drill packs.
- `content-cache`: RSS/video metadata and derived prompt packs.
- `progress-snapshots`: per-user backup snapshots.
- `mistake-ledger`: per-user mistake logs if no relational backend is active.

Use strong consistency for immediate read-after-write paths such as progress snapshots.

## AI Layer

V1 AI jobs:

- Correct typed Italian.
- Tag mistakes.
- Generate 2-3 repair prompts from a mistake.
- Generate scene dialogue options.
- Convert headlines into A2/B1 discussion prompts.

Use structured JSON responses so the UI can render corrections, tags, hints, and next drills reliably.

Suggested correction response shape:

- accepted: boolean.
- correctedItalian: string.
- britishEnglishMeaning: string.
- errorTags: string[].
- explanation: string.
- repairPrompts: string[].
- confidence: number.

## Offline Behaviour

The learner should be able to complete a daily sprint offline if the session pack has already been cached.

Offline-first priorities:

- Today queue.
- Seed scenes.
- Recent mistakes.
- Review logs waiting for sync.
- Last known stats.

AI evaluation requires network unless we add local rule-based fallbacks.

## Cost Controls

- Cache generated packs.
- Batch drill generation after sessions.
- Use AI for high-value correction and generation, not every UI transition.
- Prefer curated seed content for common structures.
- Show optional "AI review" where a deterministic check is enough.

