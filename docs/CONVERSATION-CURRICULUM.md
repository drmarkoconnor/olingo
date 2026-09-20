# Conversation curriculum: A1–C2

This is the current specification for Olingo’s conversational course. It extends the earlier A2–B1 Sentence Forge foundation; those drills remain useful supporting practice. The course is a broad practice pathway, not a complete language qualification or a guarantee of a proficiency level.

## What the levels mean

The CEFR has six common levels: **A1, A2, B1, B2, C1 and C2**. There is no official C3. Its levels describe communicative capabilities rather than a prescribed number of lessons. [Council of Europe: CEFR levels](https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions).

Olingo uses these levels to organise practice:

| Level | Increasing conversational demand |
| --- | --- |
| A1 | Greet, ask where/when, express a basic need, invite, ask for repetition. |
| A2 | Complete routine exchanges, relate simple past events and clarify practical arrangements. |
| B1 | Sustain familiar conversations, give reasons, narrate, ask follow-ups and solve problems. |
| B2 | Discuss trade-offs, negotiate an outcome and respond to complications. |
| C1 | Handle implicit meaning, precise qualification, tact and complex explanations. |
| C2 | Resolve ambiguity, adapt register, interpret implied attitudes and reconcile perspectives. |

These are curriculum summaries, not verbatim CEFR descriptors. Higher levels demand greater flexibility and judgement, not simply longer sentences or rarer vocabulary. An advanced learner should still be able to make a short, natural reply.

## Breadth: twelve strands at every level

The authored course contains one three-turn episode per strand per level: **72 episodes**, each with a changed-context transfer version. There are **216 base turns and 216 transfer tasks**. These are reusable practice opportunities, not 432 independent proficiency tests.

1. **People and connection:** greetings, introductions, invitations, support and relationships.
2. **Questions and clarification:** where, when, why, assumptions and misunderstanding repair.
3. **Life and time:** routines, experiences, narration and reflecting on change.
4. **Food and hospitality:** ordering, cooking, hosting and accommodating preferences.
5. **Shopping and services:** choosing, comparison, returns and resolving problems.
6. **Travel and arrangements:** directions, bookings, changing plans and disruption.
7. **Home and practical projects:** spaces, tasks, repairs and negotiating work.
8. **Health and wellbeing:** describing feelings, arranging care and checking understanding.
9. **Work and learning:** roles, collaboration, feedback and discussion.
10. **Culture and ideas:** music, stories, performances and interpretation.
11. **Community and public life:** participation, competing needs and public issues.
12. **Helping people understand:** relaying information, explaining differences and mediation.

Grammar is embedded in these functions. Pronouns, quantities with *ne*, agreement, auxiliary choice and tense contrasts recur when the communicative task needs them; every interaction is not forced into a pronoun transformation.

## How practice works

The organising unit is an everyday purpose: arrange a visit, resolve a return, clarify an instruction or reconcile two viewpoints. A learner receives one interlocutor cue and one task at a time, speaks, checks the transcript, then receives concise feedback. A hint can support retrieval. A changed situation later checks whether the language transfers beyond the original example.

This follows the Council of Europe’s emphasis on realistic scenarios, learner agency and purposeful use of language. The current short episodes are practice towards that approach; they do not yet reproduce a collaborative real-world project or a fully adaptive human conversation. [Council of Europe: action-oriented approach](https://www.coe.int/en/web/common-european-framework-reference-languages/the-action-oriented-approach).

Mediation begins at A1 with passing on a time or a simple notice; at higher levels it includes making ideas accessible and finding common ground. It is not reserved for advanced translation tasks. [Council of Europe: mediation](https://www.coe.int/en/web/common-european-framework-reference-languages/mediation).

The learner controls episode length and can stop after a short exchange. Completed episodes, not elapsed calendar days or received reminders, constitute practice. A one-week break does not advance the learner to a harder unit. The earlier eight-session trial means eight completed sessions, not eight dates.

## Assessment: the learner’s words

Conversation exercises use `evaluationMode: 'open-goal'`. The example illustrates one way to fulfil the task; it is not the only correct wording. Assessment must judge the learner’s answer against the situation and communicative goal, accepting other plausible meanings where the task allows choice. Required details still matter: asking for a Friday booking does not satisfy a task requiring Monday.

The recording flow separates audio capture, transcription, learner confirmation and assessment. Recognition errors can be corrected before marking. API failure is unassessed, never evidence of poor Italian. Typed and hinted attempts remain useful practice but are recorded separately from independent speech. Flow is self-reported, not inferred from typing speed; short responses do not by themselves establish conversational fluency.

## When and why practice changes

`src/learning/course-progress.ts` implements explicit scheduling heuristics:

- Independent success requires an accepted, communicative, **spoken** answer with no hints.
- A lesson becomes currently **stable** only after independent success covers every lesson turn, both base and transfer situations, and at least two successful dates separated by 24 hours.
- A spoken lapse lowers current readiness without deleting historical achievements. Recovery requires successful repair of the failed turn and further successes separated by at least 24 hours.
- Two failures in the latest three spoken attempts, with the latest attempt unsuccessful, trigger a recommendation for supported repair.
- Unstable work is reviewed after one day. Stable work receives longer intervals, up to 14 days. These intervals are product heuristics, not CEFR requirements or experimentally validated optimal intervals for this learner.
- Recommendations prioritise local repair, due review, an untried function, then a less recent episode. Where possible, they rotate away from the immediately preceding episode. Each recommendation includes its reason.

The course displays strand coverage and practice readiness. The broad-challenge indicator requires stable evidence across all twelve strands at the selected level. **The learner chooses the level manually:** this indicator neither awards a CEFR level nor automatically promotes or blocks them. Timing and flow can inform reflection without imposing a universal five-second threshold across A1 and C2 tasks.

## Limits and next evidence

The present course uses authored short exchanges and transfer variants, not an unlimited dialogue engine. A completed episode is not proof of sustained, spontaneous interaction. Recordings and transcripts also cannot alone demonstrate comprehension of unfamiliar speakers, extended listening, reading, writing or intercultural effectiveness.

Especially towards C1–C2, combine this pathway with authentic listening and reading, extended discussion, unfamiliar partners, longer narratives, collaborative tasks and informed human feedback. Maintain an uneven skills profile rather than labelling the whole learner from one grammar drill. Future expansion should deepen these areas and add genuine branching from the learner’s response, while preserving the current recording and assessment safeguards.

## Implementation references

- `src/learning/conversation-course.ts`: authored levels, strands, goals and transfer situations.
- `src/learning/course-progress.ts`: evidence, lapse recovery, review and recommendation rules.
- `src/pages/ConversationCourse.tsx`: one-turn speaking and course navigation.
- `netlify/functions/_shared/openai.ts`: meaning-sensitive and open-goal evaluation instructions.
- `src/learning/learning-profile.ts`: shared A1–C2 level ordering and supporting drill selection.

## Verification of this implementation

- Production TypeScript/Vite build passes.
- 129 unit and regression tests pass, including all level/strand coverage, open-goal assessment, delayed retrieval evidence, hint/typed separation, atomic progress rollback, and immutable attempt identity.
- Course records are committed atomically with general progress. Recorded practice uses the original capture date for delayed evidence, so an old recording assessed later is not a new day of retrieval.
- The browser smoke script is `scripts/conversation-course-smoke.mjs --serve`; it uses synthetic microphone audio and mocked transcription/assessment services. Provider quality and real microphone behaviour still depend on the live connection and device.
- C1/C2 course recordings allow up to 120 seconds; other recording contexts retain the 60-second default and the existing size limit.
