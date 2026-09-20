/**
 * Browser integration smoke for the spoken-answer boundary.
 * Run node scripts/speaking-flow-smoke.mjs --serve (starts local Vite),
 * or omit --serve to use an existing local development server.
 * Requires Playwright Chromium (npx playwright install chromium).
 * Optional: OLINGO_BASE_URL and OLINGO_CHROMIUM_PATH override local defaults.
 * Uses an isolated browser profile, synthetic microphone input and mocked APIs;
 * it never calls a paid model or touches a real learner's progress.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const testDir = await mkdtemp(join(tmpdir(), 'olingo-speech-smoke-'));
const audioFixture = join(testDir, 'microphone.wav');
const sampleRate = 48000;
const audio = Buffer.alloc(44 + sampleRate * 3 * 2);
audio.write('RIFF', 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8); audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22); audio.writeUInt32LE(sampleRate, 24); audio.writeUInt32LE(sampleRate * 2, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(audio.length - 44, 40);
for (let i = 0; i < sampleRate * 3; i++) audio.writeInt16LE(i < sampleRate * .3 ? 0 : Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16000), 44 + i * 2);
await writeFile(audioFixture, audio);

const localServer = process.argv.includes('--serve')
  ? await (await import('vite')).createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } })
  : null;
await localServer?.listen();
const baseURL = process.env.OLINGO_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.OLINGO_CHROMIUM_PATH ? { executablePath: process.env.OLINGO_CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${audioFixture}`],
});
const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1280, height: 1050 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
let transcriptionRequests = 0;
let assessmentRequests = [];
let failAssessment = false;
const recognised = 'Oggi mi sento meglio.';
const confirmed = 'Oggi sto meglio.';

await page.route('**/api/**', async (route) => {
  const pathname = new URL(route.request().url()).pathname;
  if (pathname === '/api/transcribe-speech') {
    transcriptionRequests++;
    return route.fulfill({ json: { transcript: recognised, provider: 'openai' } });
  }
  if (pathname === '/api/evaluate-answer') {
    const body = route.request().postDataJSON();
    assessmentRequests.push(body);
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (failAssessment) return route.fulfill({ status: 503, json: { status: 'unassessed', error: 'Assessment is unavailable. Your answer has not been scored and your progress has not changed. Please try again.' } });
    return route.fulfill({ json: {
      exerciseValid: true, invalidReason: '', accepted: true, communicative: true,
      // Intentionally differs: accepted alternatives must keep the learner's wording.
      correctedItalian: body.exercise.targetItalian,
      meaning: body.exercise.promptEnglish, errorTags: [],
      shortFeedback: 'Your alternative is natural and keeps the intended meaning.',
      repairPrompts: [], confidence: 0.97, provider: 'openai', status: 'assessed',
    } });
  }
  return route.fulfill({ status: 503, json: { error: 'Disabled in isolated browser test' } });
});

async function counts() {
  return page.evaluate(async () => {
    const { db } = await import('/src/storage/db.ts');
    return {
      logs: await db.exerciseLogs.count(),
      skills: await db.skillAttempts.count(),
      mistakes: await db.mistakes.count(),
      states: await db.exerciseStates.toArray(),
    };
  });
}

async function enterSentencePractice() {
  await page.goto(baseURL);
  await page.evaluate(async () => {
    const { db } = await import('/src/storage/db.ts');
    const { getTodayDateKey, getOrCreateDailySession } = await import('/src/learning/daily-session.ts');
    const uid = localStorage.getItem('olingo.localUid');
    assertLocalMode(uid);
    const date = getTodayDateKey();
    const bundle = await getOrCreateDailySession(uid, {
      programWeek: 1, dailyGoal: 30, vocabularyCount: 10, sentenceCount: 20,
      repairCount: 0, targetLevel: 'B1', sessionFocus: 'adaptive', sessionDomain: 'mixed', challengeMode: 'intensive',
    }, date);
    for (const item of bundle.items.filter((item) => item.type === 'match' || item.type === 'recall')) {
      await db.dailySessionItems.update(item.id, { completedCount: 30, status: 'complete' });
    }
    localStorage.setItem(`olingo.session-intent:${uid}:${date}`, 'confirmed');
    localStorage.setItem('olingo.settings', JSON.stringify({ tts: false, sound: false, challengeMode: 'intensive', sessionFocus: 'adaptive', sessionDomain: 'mixed', targetLevel: 'B1' }));
    function assertLocalMode(uid) { if (!uid?.startsWith('local-')) throw new Error('This smoke test is for local development only.'); }
  });
  await page.reload();
  await page.locator('#answer').waitFor();
}

try {
  await enterSentencePractice();
  const before = await counts();
  await page.getByRole('button', { name: 'Record answer', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor();
  await page.waitForTimeout(1800);
  const clock = await page.getByLabel('Recording duration').innerText();
  assert.ok(parseFloat(clock) >= 1, `Expected advancing live timer, saw ${clock}`);
  const meter = Number(await page.getByRole('meter').getAttribute('value'));
  assert.ok(meter > 0, `Expected live microphone signal, saw ${meter}`);
  assert.equal(await page.locator('#answer').isDisabled(), true, 'Typing is locked during capture');
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await page.waitForFunction((text) => document.querySelector('#answer')?.value === text, recognised);
  assert.equal(transcriptionRequests, 1);
  assert.equal(assessmentRequests.length, 0, 'Transcription must not mark the answer');
  assert.deepEqual(await counts(), before, 'Capture and transcription must not alter learning progress');
  await page.locator('audio').waitFor();
  const playback = await page.locator('audio').evaluate(async (audio) => {
    await audio.play();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const result = { currentTime: audio.currentTime, paused: audio.paused, src: audio.currentSrc };
    audio.pause();
    return result;
  });
  assert.equal(playback.paused, false);
  assert.ok(playback.currentTime > 0);
  assert.ok(playback.src.startsWith('blob:'));
  await page.locator('#answer').fill(confirmed);
  await page.waitForFunction(async (text) => {
    const { db } = await import('/src/storage/db.ts');
    return (await db.speakingDrafts.toArray())[0]?.transcript === text;
  }, confirmed);
  failAssessment = true;
  await page.getByRole('button', { name: 'Confirm transcript and assess', exact: true }).click();
  await page.getByText('Assessment is unavailable.', { exact: false }).waitFor();
  assert.equal(assessmentRequests.length, 1);
  assert.equal(assessmentRequests[0].answer, confirmed, 'The confirmed response, not ASR or model wording, must be assessed');
  assert.deepEqual(await counts(), before, 'API failure must leave all learning progress unchanged');
  assert.equal(await page.locator('#answer').inputValue(), confirmed);
  await page.screenshot({ path: '/tmp/olingo-speaking-unassessed.png', fullPage: true });
  await page.reload();
  await page.waitForFunction((text) => document.querySelector('#answer')?.value === text, confirmed);
  await page.locator('audio').waitFor();
  assert.equal(transcriptionRequests, 1, 'Reload restores the draft without silently resending audio');
  assert.equal(assessmentRequests.length, 1, 'Reload must never submit an unconfirmed draft');
  assert.deepEqual(await counts(), before, 'Reload of an unassessed response must not award progress');
  failAssessment = false;
  // Two synchronous form events exercise the in-flight lock without Playwright's auto-wait hiding the race.
  await page.locator('form.answer-card').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await page.locator('.feedback-good').waitFor();
  assert.equal(assessmentRequests.length, 2, 'Double submission must make exactly one retry request');
  const after = await counts();
  assert.equal(after.logs, before.logs + 1);
  assert.equal(after.skills, before.skills + 1);
  assert.equal(after.mistakes, before.mistakes);
  const evidence = await page.evaluate(async () => {
    const { db } = await import('/src/storage/db.ts');
    return { log: (await db.exerciseLogs.toArray()).at(-1), skills: await db.skillStates.toArray(), drafts: await db.speakingDrafts.count() };
  });
  assert.equal(evidence.log.answer, confirmed);
  assert.equal(evidence.log.spoken, 1);
  assert.ok(evidence.log.responseLatencyMs == null, 'Record-to-voice delay must not masquerade as retrieval latency');
  assert.ok(evidence.skills.every((skill) => skill.fastSpokenSuccesses === 0));
  assert.equal(evidence.drafts, 0, 'Successful assessment clears the saved unmarked draft');
  assert.ok((await page.locator('.feedback-good').innerText()).includes(confirmed), 'Feedback must retain a valid alternative');
  assert.equal(await page.locator('audio').count(), 1, 'Replay remains available after marking');
  await page.screenshot({ path: '/tmp/olingo-speaking-assessed.png', fullPage: true });
  assert.deepEqual(pageErrors, []);
  console.log('PASS: real MediaRecorder, live timer and input meter, audio playback, transcript confirmation, alternative wording retained, API outage causes no progress, reload restores draft, retry scored once, no false fast-recall credit.');
} finally {
  await context.close();
  await browser.close();
  await localServer?.close();
  await rm(testDir, { recursive: true, force: true });
}
