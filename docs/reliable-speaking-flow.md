# Reliable spoken answers

This change implements the first integration slice described in `speaking-integration-review.md`. It improves the existing Today, Drills and Memory House answer paths; it does not yet redesign the conversation curriculum or daily activity selection.

## Learner flow

1. Press **Record answer** and allow microphone access. A live timer and input meter show that capture is working. Stop manually, or recording stops at 60 seconds or the size limit.
2. Replay the recording and read the transcript. Correct misheard words to match what was actually said. No assessment request or learner score is made at this stage.
3. Press the explicit confirmation/assessment button. The confirmed words are evaluated against the communicative goal. Accepted alternative wording remains visible; the stored model is a separate example.
4. Continue after assessment. If the API is unavailable, retry later without a score penalty. The recording and editable transcript are kept in this browser's IndexedDB until assessed or discarded, including through refresh when returning to the same exercise.

Typing remains available. Transcription failures permit a manual transcript of the recording, or discarding it and submitting a typed answer. Microphone permission failures never fabricate a recording or timing result.

## Evidence and timing

- Recorder onset is an estimate from sustained input energy, not a linguistic speech detector. Isolated clicks and measured silence do not produce a valid voice onset. If analysis is unavailable, timing is unknown.
- The cue is already visible before recording begins. The UI therefore labels onset relative to **recording start**. It is deliberately not used to award fast prompt-retrieval mastery.
- Successful exercise logs retain the raw transcript, confirmed transcript, recording duration, onset estimate, utterance estimate and attempt identifier. Audio is not added to assessed exercise logs; local draft audio is deleted after assessment. The current recording can remain in memory for playback until navigation.
- Drafts are isolated by learner and exercise. They are local to that browser, not a new cloud audio archive or cross-device synchronisation feature.
- Progress changes are transactional. Duplicate or restored attempt identifiers reuse the saved assessment and cannot earn another progress increment. A failed transcription or assessment is not written as a learner mistake.

## Assessment behaviour

The existing Netlify API connection and configured models are retained. The semantic response is validated before it can affect progress. Missing credentials, provider failures, refusals or malformed responses return an explicit unassessed state instead of falling back to token comparison. This applies to typed sentence and mistake-repair assessment as well, so offline users can retain an answer but cannot receive a misleading semantic grade.

Invalid exercises are still quarantined without learner penalty. Accepted answers retain the learner's wording. Corrective feedback and mistake records use the assessor's correction rather than automatically substituting the canonical model sentence.

## Verification

The production build and 105 unit/regression tests pass. Tests cover malformed and unavailable assessment, preservation of natural alternatives, transactional rollback, duplicate attempts, nullable timing, silence and capture limits.

The browser smoke uses a real Chromium MediaRecorder with synthetic microphone audio and mocked transcription/assessment endpoints. It verifies the live timer/meter, playback, transcript confirmation, edited-answer submission, API outage with unchanged progress, reload recovery, duplicate submission protection, accepted alternative display and absence of false fast-recall credit.

Run:

```sh
npm ci
npm run build
npm test
npx playwright install chromium
node scripts/speaking-flow-smoke.mjs --serve
```

An existing Chromium executable can be supplied with `OLINGO_CHROMIUM_PATH`. These checks do not use production API credentials or modify an existing learner's data.

Before production acceptance, verify microphone permission, playback, Italian transcription and assessment on Mark's actual browser/device using the existing authenticated Netlify integration. Synthetic browser checks establish the application flow, not real-world recognition quality or microphone compatibility.
