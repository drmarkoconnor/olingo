# Renewable conversations: implemented behaviour

Olingo now combines its authored A1–C2 curriculum with generation of new situations and responses to the learner's actual words. The authored course remains the curriculum anchor and a usable fallback. It is no longer the only source of conversational material.

This document describes implementation, not a guarantee of unlimited originality, flawless AI feedback or achievement of a CEFR qualification. See [Conversation curriculum](CONVERSATION-CURRICULUM.md) for the twelve strands and level purposes, and [Accounts and storage](ACCOUNTS-AND-STORAGE.md) for identity and data ownership.

## The three implemented capabilities

These are cumulative product capabilities, not three proficiency bands or three lessons that every learner must complete in order.

### 1. Fresh situations within a stable curriculum

Selecting **Start a fresh conversation**, a garden bed or a strand's **Fresh conversation** button requests a new three-turn episode. The server resolves the selected lesson against the authored curriculum. Its level, strand and can-do objective remain the anchors; the model cannot create a new level or replace those anchors with an unrelated topic.

The generator varies setting, roles, practical purpose and constraint. A preference such as gardening or music can influence examples, but is not meant to replace curriculum coverage. Interests are optional, limited to eight short entries, and saved in the learner's conversation profile. The client does not yet send a comprehensive per-error mastery model into generation: adaptation currently combines the recommended curriculum goal, chosen level, optional interests, recent situation history and subsequent actual dialogue.

Higher-level conversations can use several sentences. The previous sentence/drill generators' universal 10–12-word targets are not imposed on this endpoint. Instead, structural upper bounds increase by level, from 35 words per partner/example utterance at A1 to 300 at C2. These are rejection limits, not targets to fill; prompts still ask for level-appropriate, useful speech.

**Authored practice** remains available separately. Its 72 episodes and transfer variants provide curated examples, predictable practice and an alternative when generation is unavailable. Choosing it does not pretend that a fresh episode was generated.

### 2. Follow-ups shaped by the learner's response

The first generated episode supplies a coherent three-turn outline. After a learner records or types an answer, confirms its wording and receives assessment, **Next conversational turn** sends the actual confirmed partner/learner exchange for a new follow-up. Turns two and three can therefore respond to a choice, refusal, question or clarification that differs from the illustrative answer.

The follow-up is instructed to preserve agreed details and pursue the episode's communicative purpose. It does not insert grammar correction into the partner's reply; assessment remains separate. Example answers stay hidden until after assessment, and open-goal marking accepts valid alternative choices and wording.

The server stores each episode under its authenticated owner and verifies that preceding partner lines match lines actually issued for that episode. A branch is cached by episode, turn index and dialogue hash. Stable initial request IDs and generation leases reduce duplicate work on retries. These safeguards support continuity; they do not make the model equivalent to a human interlocutor.

The interaction is intentionally a **three-turn mini-conversation**, followed by a recap and a choice to stop or continue in a fresh situation. It is not an endless audio call, streaming speech-to-speech system or unconstrained chatbot.

### 3. Conversation from supplied material

A learner can add a labelled extract, notes and an optional source link under **Bring your interests or a source**. The Sources reader also offers a route into conversation practice using its displayed adapted reading.

The distinction matters:

- A pasted passage is **supplied material**. The generator receives that passage; providing a URL does not cause this endpoint to fetch or independently verify the linked article.
- Material passed from Sources is explicitly labelled an **adapted reading** or **adapted news summary**. It must not be presented as a verbatim original article.
- With no supplied source, generated scenarios are ordinary **fictional practice situations**, not researched news.
- With a source, the model is instructed to retain supported factual content, distinguish reported claims from facts and make any added role-play hypothetical. It returns exact supporting quotations from the supplied extract. Structural validation checks that those quotations occur in the extract; it does **not** prove that every generated claim follows from them.

The source label, extract and optional link remain attached to the episode and available in the conversation UI. Initial source quotations and novelty metadata are stored as generation provenance. The endpoint has no independent fact-checking or automatic live-news retrieval step. Learners should retain uncertainty and attribution when discussing disputed material.

## Originality and deliberate repetition

New-situation generation stores the latest 40 generated situations for each learner and curriculum lesson. The model receives the latest 20 situation summaries. The client can also submit up to 20 situations to avoid. Each situation records its setting, roles, goal and constraint without relying on people's names.

Filtering checks an exact situation key, token overlap in the context, and similarity across the four novelty dimensions. A candidate that fails structure, source quotation checks or novelty checks can be regenerated once. If no usable candidate remains, the service reports unavailability rather than relabelling an old exercise as new.

This is stronger than changing a name or noun, but it remains a **bounded, lexical/concept-field heuristic**, not a semantic guarantee against repetition. Older situations can recur beyond the recent window, and paraphrases can evade matching. Fresh scenarios and scheduled retrieval serve different purposes: revisiting a capability is intentional even when its setting changes. More generated content does not by itself mean more learning.

## Evidence across generated contexts

All generated turns retain the authored lesson's three canonical capability IDs. A generated episode's UUID is saved as `contextId` on each assessed course attempt. Creating a fresh episode does not create a fresh skill with no history.

Current establishment requires:

1. Accepted, communicative, recorded speech without hints.
2. Successful coverage of all three canonical goals, considered across the lesson's history.
3. At least two distinct successful contexts.
4. Success on separate dates at least 24 hours apart.
5. Recovery from any intervening spoken lapse according to the local repair rule.

Two different generated episodes can supply the two contexts; an authored baseline is not compulsory. Repeating the same generated episode under a new run ID does not create another context. Legacy authored records without `contextId` derive a context from lesson ID plus base/transfer variant. Typed, hinted or unsuccessful answers do not establish a new successful context. These are course heuristics, not official CEFR assessment rules.

The recording's original capture date is used when available. Assessing an old recording on a later date is not a new retrieval session. Flow remains self-reported, and the microphone-onset timer is not represented as prompt-to-answer latency.

## Guidance, recap and garden

A returning learner sees a recap of the latest **actual assessed run**, including a partial run. It uses the saved episode title, practice date, accepted wording and up to two useful repair targets. No submitted answer means no invented session. An unfinished conversation can be resumed.

The twelve garden beds correspond to the twelve strands at the selected level:

| Display | Evidence represented |
| --- | --- |
| Roots | Ready to explore or early practice; independent speech may not yet have been observed. |
| Growing | Successful unassisted spoken evidence is accumulating. |
| Established | The delayed, cross-context establishment rule has been met at some point. |
| Review marker | Current recall needs attention or a spaced return is due. |

The garden retains achieved growth after a lapse or absence. It does not kill or wilt plants as a penalty. The separate current-readiness count can decrease after a genuine spoken difficulty, while historical growth remains visible. Text labels and evidence details accompany the visual plants; colour is not the only signal.

Level advice is optional. It distinguishes **we have not seen this yet** from **you cannot do this**. Current heuristics offer a foundation sample when fewer than four of six everyday A1 areas have all three independent spoken goals represented, or a preceding-level sample when fewer than six of twelve areas have delayed evidence. Broad stable evidence at the chosen level can bypass the beginner suggestion. These thresholds are practical sampling policies, not placement-test cut-offs. The learner can always continue at the selected level.

## Persistence and honest scope

Course history is saved locally first and synchronised to the authenticated learner's Netlify Blobs records. This includes:

- Course attempts with confirmed wording, assessment, support/spoken evidence, canonical goal IDs, context ID and practice date. Recorded attempts also retain their raw and confirmed transcript, recording duration, measured voice onset and utterance duration when available, with an explicit recording-start timing basis. These measurements travel with course history; they are not silently converted into prompt-to-answer latency.
- Conversation run checkpoints and episode content, including adapted follow-ups.
- The conversation profile's selected level and interests.

Stable attempt IDs avoid counting a retry or downloaded record as a new practice event. Documents retain immutable server revisions; the local view selects the latest revision deterministically. A visible status distinguishes synced, pending, offline and failed sync. Local records remain available on a sync failure, and a JSON export provides a portable snapshot. Raw recordings are not included in that export.

**This is conversation-course synchronisation, not a migration or cloud backup of every historical Olingo table.** Legacy drill, vocabulary, source and general exercise histories retain their existing storage paths. The separate Supabase scaffold is not the implementation of this new history service. Device settings are not all promised to synchronise; consult the accounts document for the actual boundary.

## Failures and limits

- Fresh generation failure offers a retry or an explicitly authored episode.
- A failed responsive continuation preserves the assessed answer and offers a retry or the already prepared next turn. Choosing the prepared turn is a fallback, not a claim that it reacted to the learner's answer.
- Transcription and assessment remain separate. The learner checks misheard words before submission. Assessment failure leaves the answer unassessed and must not penalise progress.
- An episode is structurally validated, but there is not a second independent pedagogical model review of every generated follow-up. The assessor can identify an incoherent prompt; naturalness, level fit and judgement still require ongoing evaluation with real users.
- Token-overlap novelty checks, model instructions and exact quote membership checks each have limits. None certifies originality, factual entailment or authentic C2 interaction.
- The pathway covers broad conversational purposes. Extended listening, unfamiliar speakers, reading, writing, intercultural experience and sustained human interaction remain necessary parts of wider proficiency.

## Implementation map

- `src/learning/conversation-course.ts`: authored levels, goals and anchor tasks.
- `netlify/functions/generate-conversation.ts` and `_shared/conversation-generation.ts`: fresh episodes, dialogue-aware continuation, validation and novelty history.
- `src/learning/conversation-client.ts` and `generated-conversation.ts`: request contracts and client validation.
- `src/pages/ConversationCourse.tsx`: one-turn UI, source input, generation choices and failure recovery.
- `src/learning/course-progress.ts`: canonical capability evidence, contexts and review scheduling.
- `src/learning/conversation-guidance.ts`: recap, optional level sampling and retained garden growth.
- `src/components/ConversationGarden.tsx` and `SessionRecap.tsx`: accessible evidence displays.
- `netlify/functions/conversation-history.ts`, `_shared/conversation-storage.ts` and `src/learning/conversation-sync.ts`: account-scoped course history and export.

Verification should distinguish automated contract/behaviour tests from live provider quality, real microphone capture and multi-device account-holder checks. Do not infer those live outcomes from mocked tests.
