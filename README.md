# Olingo

Olingo started as a mobile-first Italian vocabulary flashcard PWA. The current
direction is now a more substantial A2-to-B1 Italian sentence-production game
focused on fast, accurate typed construction for spoken conversation.

The new foundation docs live in [docs/README.md](docs/README.md). They supersede
the original flashcard-only PRD and should guide new product and engineering
work.

## Legacy Starter App

The existing app still contains the original flashcard prototype:

## Features

- Flashcards with flip animation, color-coded by part of speech
- Spaced Repetition (SM-2-like) with mastery auto-archive
- Offline-first: IndexedDB (Dexie) + service worker
- CSV import (italian, english, pos, category)
- Categories, basic stats, settings
- Ready for Supabase sync (schemas included in `supabase/schema.sql`)

## Getting started

1. Install deps

```sh
npm install
```

2. Run the app (dev)

```sh
npm run dev
```

Open the link printed (usually http://localhost:5173).

3. Import your CSV

- Navigate to Import (via Settings or `/import`) and upload a CSV with headers:
  `italian,english,pos,category`.
- Example:

```
italian,english,pos,category
casa,house,noun,Home
mangiare,to eat,verb,Kitchen
rosso,red,adj,Colors
```

4. Study

- Tap a card to reveal answer. Mark Correct/Wrong to schedule next review.
- Due queue is capped to 20 per session for now.

## Supabase setup (manual)

- Create a new Supabase project.
- Run the SQL in `supabase/schema.sql`.
- Create anon and service role keys; add them to `.env` (see `.env.example`).
- Later, you can wire sync by using `@supabase/supabase-js` to mirror `words`,
  `user_cards`, and `review_logs`.

## Testing

```sh
npm test
```

## Notes

- Offline-first by design. Sync is optional.
- Scheduler archives after 3 correct with interval >= 180 days.

## Roadmap (from PRD)

- More study modes (MCQ, Matching, Speed Review)
- Streaks and achievements
- Audio (TTS) for pronunciation
- Leaderboards (optional)
