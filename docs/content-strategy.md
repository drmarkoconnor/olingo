# Content Strategy

## Content Goals

Content should feed sentence production, not passive reading.

Every imported item should become one or more of:

- A phrase chunk.
- A sentence frame.
- A transformation drill.
- A scene prompt.
- A short culture/news conversation objective.
- A mistake repair item.

## Source Types

### Seed Curriculum

Create curated local content first. This keeps v1 useful without depending on live APIs.

Seed data should include:

- Phrase chunks.
- Sentence frames.
- Scene prompts.
- Correct answer variants.
- Error tags.
- Hints.
- Difficulty level.
- British English prompt text.

### Italian News

Good fit for culture/news chat.

Candidates:

- ANSA RSS feeds for headlines and category feeds.
- RaiNews RSS and topic pages.
- Other sources only after checking terms and feed stability.

Use:

- Title.
- Link.
- Source.
- Published date.
- Short summary generated from user-visible feed content or article metadata where allowed.
- Derived prompt, not copied full article text.

Do not store full copyrighted articles unless licensing explicitly allows it.

### YouTube

Good fit for culture, listening, and later transcript-derived drills.

Use the YouTube Data API for:

- Search.
- Video metadata.
- Channel metadata.
- Embeds.

Treat captions/transcripts carefully. Do not assume captions can be downloaded or stored. For v1, embed videos and generate prompts from title/description/metadata or from manually curated clips.

### Tatoeba

Good fit for sentence pairs and example variants.

Tatoeba has API and downloadable sentence data, but many sentences require attribution under Creative Commons terms. Store attribution metadata with imported sentence pairs.

### Wikimedia/Wiktionary

Useful for dictionary-style lookups, examples, and pronunciation metadata, but extraction can be inconsistent. Use as enrichment, not a core dependency.

### Morphology And NLP

Candidates:

- Morph-it! for Italian inflected forms and lemmas, subject to licence review.
- spaCy Italian models for server-side POS, lemmatisation, and sentence analysis.

These are useful for hints, validation, and mistake tagging, but v1 can begin with curated answer patterns and AI-assisted feedback.

## AI-Generated Content

AI is acceptable for:

- Generating drill variants.
- Explaining mistakes.
- Creating scene dialogue.
- Tagging errors.
- Producing structured correction JSON.
- Creating level-appropriate news discussion prompts.

Rules:

- AI calls must run server-side through Netlify Functions or another backend.
- Never expose API keys in the browser.
- Use structured outputs for correction and exercise generation.
- Cache generated packs where possible to control cost.
- Keep human-reviewable seed packs for the core curriculum.

## Content Object Types

### Phrase Chunk

Fields:

- id.
- italian.
- britishEnglish.
- usageNote.
- level.
- phraseFamily.
- sceneIds.
- tags.

### Sentence Frame

Fields:

- id.
- promptEnglish.
- acceptedItalian.
- alternatives.
- targetPattern.
- level.
- hints.
- tags.
- sceneIds.

### Scene Prompt

Fields:

- id.
- sceneId.
- npcPersonaId.
- objective.
- promptEnglish.
- expectedFunction.
- acceptedItalian.
- feedbackFocus.
- choices.

### Mistake Item

Fields:

- id.
- userId.
- sourcePromptId.
- userAnswer.
- correctedAnswer.
- tags.
- explanation.
- repairPrompts.
- srsState.

## Attribution

Store source attribution for all external content:

- sourceName.
- sourceUrl.
- licence.
- author or contributor where required.
- fetchedAt.
- derivedContentIds.

The app UI should provide a simple "source" link for news/video-derived tasks.

