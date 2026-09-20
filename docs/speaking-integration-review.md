# Olingo and Parliamo: speaking integration review

Review date: 20 September 2026. This is a proposed integration, not an implemented change.

## Evidence and limits

Reviewed Olingo main commit `f517b09339489e66beacc21b319406ad5a42ab07`, the README, all six current foundational documents in `docs/`, and the recording, transcription, assessment, progress and curriculum code. The historical `prd.md` explicitly defers to the current documents. Netlify's published deployment for `italianlingo.netlify.app` reports this same commit and includes the speech and assessment functions.

The Mac checkout at `/Users/moc/repos/all_things_coding/2025/olingo` is not mounted in this workspace. Unpushed changes there are outside this review. No production credentials were retrieved, no paid speech/assessment request was made, and no runtime code or deployment was changed. Deployment presence establishes that the integration exists; it does not establish that today's credentials, quota and microphone path all work.

Subsequent checkout check: Mark reported local `main` and `origin/main` at `1cbf54e` ("Generate level-aware speech practice"). GitHub's commit comparison confirms that this is an ancestor seven commits behind the reviewed `f517b09`, not newer work. The reported local remote-tracking reference was stale. The reviewed version includes the level-aware generation work plus later sentence recording/transcription, skill mastery, drill and Memory House additions. The integration review therefore remains based on the newer repository version; any uncommitted Mac changes still require a separate status check before updating that checkout.

## Recommendation

Use Olingo as the single application and curriculum engine. Add a focused Speak mode using the best parts of Parliamo's recorder, transcript confirmation and feedback experience. Keep Netlify Identity and the existing server-side API integration. Do not rebuild Olingo in Next.js merely to merge the projects: both frontends use React, and the useful components can be adapted to Olingo's Vite application.

Parliamo should serve as the interaction prototype and a source of reusable components, not a second competing learner history. Preserve both applications until the replacement flow is verified. Any eventual history import must retain source and attempt identifiers and avoid duplicate mastery credit.

## What to retain

| Source | Keep | Adaptation |
| --- | --- | --- |
| Olingo | Curriculum, phrase families, scene contexts, review scheduling, mistake ledger, learner profiles | Make selection reasons visible and use successful delayed retrieval to guide progression |
| Olingo | Protected speech transcription and AI assessment | Confirm the transcript before marking; make unavailable assessment explicitly unassessed |
| Olingo | Assessment prompt accepting natural alternatives and auditing bad exercises | Keep these safeguards throughout the UI, fallback and progress paths |
| Parliamo | Visible recording state, timer, input meter, playback and editable transcript | Port into Olingo's authentication and Netlify endpoints rather than its separate hosting/database stack |
| This tutoring history | Mark's preferences, demonstrated strengths and recurring errors | Import as an editable starting profile, not fabricated historical scores or a global CEFR diagnosis |

## Findings that matter first

1. **Recognised speech is marked before Mark confirms it.** `src/pages/Study.tsx` sends the transcription directly to `submitSentenceCandidate`. Recognition errors can therefore enter the mistake ledger and change review scheduling. Add a transcript confirmation state before evaluation.

2. **Assessment outages can become learner errors.** `netlify/functions/evaluate-answer.ts` uses `ai ?? fallback`; `src/learning/progress.ts` also falls back locally on API failures. The deterministic evaluators compare stored answers and token overlap. They cannot reliably reject an otherwise valid conversational paraphrase. For open production, an outage must produce “Saved, awaiting assessment”, with no negative mastery update. A known exact answer can still receive limited deterministic confirmation in a closed drill, clearly labelled.

3. **Timing is not yet a clean measure of spoken retrieval.** `SentenceVoiceRecorder.tsx` measures from prompt start, including setup and microphone delay, and substitutes recording start if speech is not detected. Establish microphone readiness before the timed prompt. Record prompt-to-first-voice separately from utterance duration and processing time. Silence must produce a missing measurement, never an invented zero or onset. Live timer and playback should make the recording observable.

4. **The curriculum already contains conversational breadth, but the experience does not reliably expose it.** `conversation-frames.ts`, `session-focus.ts` and the curriculum documents include questions, plans, opinions and repair. The integration needs better orchestration, not simply more nouns in the same transformation template. Calendar-based programme defaults should be subordinate to current retrieval evidence and user choice.

5. **Mastery needs current stability as well as cumulative achievement.** `skill-mastery.ts` already distinguishes spoken, unassisted, transfer and delayed contexts. However, historical stage counts can remain high after lapses. Keep a historical best separately from current readiness, and award cross-context stability from successful attempts rather than merely visited contexts.

6. **Preferences and records need one consistent path.** `daily-session.ts` includes a pronunciation activity despite Mark's explicit preference to practise that elsewhere. Disable it for his profile. Speech records, local exercise logs and cloud review data currently have different paths; use a shared attempt identifier and idempotent sync before combining dashboards.

## The speaking flow

1. Check the microphone and show that it is working.
2. Present one situation or conversational turn; start response timing when the cue is available.
3. Record the answer with a visible timer and meter; allow replay or retry.
4. Transcribe it, show “What I heard”, and let Mark correct recognition mistakes. Preserve raw and confirmed versions separately.
5. Assess the confirmed answer for communicative success, requested grammatical target and completeness. A different valid answer is accepted. Explain at most one or two useful corrections, using Mark's wording where possible.
6. Update progress once and select the next conversational turn or repair. Keep corrected transcription separate from a learner rewriting the answer after feedback.

Use explicit states: recording, transcribing, awaiting confirmation, assessing, assessed, or saved/unassessed. A suggested answer is labelled as an example, not the only correct sentence. Text-only input remains available, but does not count as evidence of spoken speed. Transcript and latency alone must not be presented as a comprehensive measure of fluency.

An attempt should link the exact prompt and version, communicative goal, target skill, support shown, raw/confirmed transcript, response timing and its validity, assessment provenance, corrections, and scheduling outcome. This makes feedback explainable and permits re-assessment without duplicate credit.

## Teaching design for Mark

The chat evidence supports better retrieval of pronouns, partitives, combinations and familiar tense patterns. It does not establish spontaneous conversational fluency: most evidence came from typed transformations, and reported response times were not consistently measured aloud. Increasing lexical variety exposed instability in verb forms, quantities and maintaining person/tense across clauses. These are useful targets, not grounds to reset the whole course.

Start with a 12–15 minute option and an optional extension, replacing the obligation to complete four batches of eight. Aim for many short successful speaking turns without making a fixed count the goal:

- Two minutes of easy delayed retrieval, including ordinary questions and responses.
- Five minutes in a three-to-five-turn scenario, with follow-ups responding to what Mark actually said.
- Three minutes of brief repairs drawn from actual errors, mixed with easy items.
- Two minutes of the same communicative goal in a different setting, with less support.
- A short debrief explaining what improved, what will return, and why.

Rotate conversational functions deliberately: greeting and checking in; locating things; asking times and availability; proposing and accepting plans; clarifying and repairing misunderstanding; recounting something briefly. Keep pronouns embedded where natural. Do not force a combined clitic into every everyday exchange.

Example episode: arrange dinner with a friend. Mark asks what time the friend finishes work, proposes a restaurant, responds to it being full, asks to reserve somewhere else, then confirms the plan. A later repair can revisit a quantity or modal construction from that same exchange. This practises selecting language for a purpose as well as transforming it.

Before each session show three short items: “Today's conversation”, “Forms we are revisiting”, and “Why these”. Use actual delayed errors, gaps in conversational coverage, support dependence and recent hesitation to choose tasks. Increase complexity after successful low-support responses across separated occasions. After a lapse or break, reduce clause length and restore a small cue; do not remove everyday conversation or repeat an entire grammar syllabus.

## Delivery sequence and acceptance

**First: one complete reliable spoken turn.** Port recording/replay/transcript confirmation, correct timing, reuse the deployed transcription/evaluation endpoints, and remove negative outage fallback. Verify on Mark's actual browser and microphone: real audio, visible elapsed time, editable transcript, valid alternative accepted, no assessment for silence, and no learning penalty on API failure.

**Second: trustworthy learner history.** Introduce a shared attempt contract, preserve existing progress, separate written and spoken evidence, honour profile preferences and make assessment/sync idempotent. Verify that a corrected transcription does not create an extra mistake or duplicate score, and that users' histories remain separate.

**Third: conversation episodes and transparent adaptation.** Build a small curated set of everyday question/response scenarios with controlled follow-ups, then introduce AI variation within those goals. Retain a short delayed test in a different setting. Judge the trial by independent spoken turns, time to begin, support needed, meaning conveyed and recurrence of errors—not by agreement with a model sentence.

Do not mark eight trial sessions complete merely because eight scheduled days have passed. Review only after genuinely completed sessions provide comparable spoken evidence.

## Working here and on the Mac

This workspace can use the connected GitHub repository; it cannot directly read arbitrary files on Mark's Mac. Continue development here against a branch of Olingo. Check the Mac with `git status --short` and `git log -1 --oneline`; push any relevant unpublished source/docs to a branch, or attach those files without secrets. No API key needs to be pasted into chat.

The model collaborating in this conversation, the Mac app's available model picker, and Olingo's runtime `OPENAI_MODEL` setting are separate choices. Moving source through GitHub does not require moving this conversation to a Sol-only client. Changing the app's assessment model, if useful later, is a separate configuration and validation task.
