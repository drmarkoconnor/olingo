# Implementation Roadmap

## Phase 0: Foundation

Goal: replace the flashcard-first direction with a sentence-production product model.

Deliverables:

- Product vision.
- Learning model.
- Curriculum map.
- Content strategy.
- Architecture notes.
- V1 milestone backlog.

## Phase 1: Game Shell And Daily Sprint

Goal: make the first screen feel like a usable game, not a landing page.

Build:

- Home as Daily Sprint dashboard.
- Photoreal scene panel with location, NPC, and today's objective.
- Button actions: Start Sprint, Practise Mistakes, Continue Story, View Fluency.
- 15-minute session pacing.
- Mobile bottom nav revised around Today, Scenes, Mistakes, Stats, Settings.
- Desktop layout with scene/map and task panel side by side.

Definition of done:

- App opens directly into today's quest.
- User can complete a short mixed session using seeded exercises.
- Existing word-only flashcard loop is no longer the main experience.

## Phase 2: Sentence Forge

Goal: typed sentence production with quick feedback.

Build:

- Prompt card.
- Typed Italian answer.
- Optional hint buttons.
- "Check", "I was close", "Show model", and "Next" actions.
- Deterministic acceptance for curated alternatives.
- SRS outcome recording.

Exercise types:

- Translate intent.
- Complete sentence.
- Transform sentence.
- Reply to NPC.

Definition of done:

- Learner can complete 20 seeded production exercises.
- Speed and accuracy are recorded.
- Mistakes create MistakeItems.

## Phase 3: Mistake Gym

Goal: every mistake becomes future practice.

Build:

- Mistake list grouped by error tag.
- Repair queue.
- Mini-drills generated from mistake templates.
- SRS scheduling for mistake items.
- Debrief after daily session.

Definition of done:

- A wrong answer creates a tagged repair item.
- Repair items return in later sessions.
- Stats show repeat-error reduction.

## Phase 4: Scene Quests

Goal: button-driven game interaction inside photoreal places.

Build:

- Scene map/grid.
- Scene state and unlocks.
- NPC prompt panel.
- Action buttons for intent/tone.
- Typed response.
- Narrative progress meter.

Initial scenes:

- Milan Cafe.
- Family Kitchen.
- Bookshop.
- Newsstand/Piazza.
- Railway Platform.
- Cinema/Cultural Event.

Definition of done:

- Each scene has at least three objectives.
- Completing objectives unlocks the next scene beat.
- Narrative progress is visible.

## Phase 5: AI Feedback

Goal: improve correction quality and reduce manual content burden.

Precondition:

- Confirm API key handling and server-side storage.

Build:

- Netlify Function for answer evaluation.
- Structured AI correction output.
- Mistake tagging.
- Repair prompt generation.
- Cost-aware caching and logging.

Definition of done:

- AI feedback is available for free-typed answers.
- API key is never exposed client-side.
- User can disable AI feedback if needed.

## Phase 6: External Content

Goal: turn news/video topics into level-appropriate production drills.

Build:

- RSS ingestion endpoint.
- Source attribution.
- Content pack cache.
- "Today's Culture Prompt".
- A2/B1 sentence frames from current topics.

Definition of done:

- App can show one current Italian headline/topic.
- Learner gets a safe, short discussion prompt from it.
- Source is linked and attributed.

## Phase 7: Partner Play

Goal: support collaborative practice for two learners.

Build:

- Multiple profiles.
- Same-device conversation relay.
- Shared daily challenge.
- Compare fluency stats without shaming.
- Optional cloud sync.

Definition of done:

- Two learners can take turns in a session.
- Progress remains separate.
- Collaborative prompts feel conversational.

## Design Notes

- Use icons in buttons where possible.
- Use bright but balanced colour, avoiding a single-hue palette.
- Use photoreal scene assets for the main visual atmosphere.
- Keep compact controls stable on mobile.
- Do not put explanation text all over the interface.
- The game should teach by doing, not by describing itself.

## Immediate Next Build Step

Implement Phase 1 and the beginning of Phase 2:

- Replace the Study-first home with a Daily Sprint game shell.
- Add seeded scene and exercise data.
- Add typed answer flow.
- Add basic mistake capture locally.
- Keep the existing scheduler but adapt it to exercise items.

