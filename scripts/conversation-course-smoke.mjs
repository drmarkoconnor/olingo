/**
 * Browser integration smoke for the conversational course.
 * Run node scripts/conversation-course-smoke.mjs --serve (starts local Vite),
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
let recognised = 'Sto bene, e tu?';
const confirmed = 'Bene, grazie! Tu come stai?';

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

async function evidence() {
  return page.evaluate(async () => {
    const { db } = await import('/src/storage/db.ts');
    return { course: await db.courseAttempts.toArray(), logs: await db.exerciseLogs.toArray(), skills: await db.skillStates.toArray(), mistakes: await db.mistakes.toArray() };
  });
}
async function assertNoOverflow(label) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(sizes.scroll <= sizes.width + 1, `${label}: page width ${sizes.scroll} overflows viewport ${sizes.width}`);
}

try {
  await page.goto(`${baseURL}/conversations`);
  assert.ok(await page.evaluate(() => localStorage.getItem('olingo.localUid')?.startsWith('local-')), 'Only run against local development');
  await page.locator('.course-card').first().waitFor();
  for (const level of (process.env.OLINGO_SMOKE_LEVELS || 'A1,A2,B1,B2,C1,C2').split(',')) {
    await page.getByRole('button', { name: level, exact: true }).click();
    assert.equal(await page.getByRole('button', { name: level, exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.course-card').count(), 12, `${level} should expose every strand`);
    assert.equal(await page.locator('.course-level-summary h3').count(), 1);
    await assertNoOverflow(`${level} desktop`);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoOverflow(`${level} mobile`);
    await page.setViewportSize({ width: 1280, height: 1050 });
  }
  await page.getByRole('button', { name: 'A1', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/olingo-course-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/olingo-course-mobile.png', fullPage: true });
  await page.locator('.course-card').first().getByRole('button', { name: 'Explore conversation' }).click();
  await page.locator('#course-answer').waitFor();
  assert.equal(await page.locator('.course-turn').count(), 1, 'Present exactly one turn');
  assert.equal(await page.getByText('Turn 1 of 3', { exact: true }).count(), 1);
  assert.equal(await page.getByText('One possible answer', { exact: true }).count(), 0, 'No model answer before assessment');
  assert.ok(!(await page.locator('body').innerText()).includes('Ciao Elisa, mi chiamo Alex.'), 'Example should not leak into initial prompt');
  await assertNoOverflow('Turn mobile');
  const typed = 'Ciao Elisa! Sono Alex, piacere.';
  await page.locator('#course-answer').fill(typed);
  const before = await evidence();
  failAssessment = true;
  await page.getByRole('button', { name: 'Assess typed practice', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Assessment is unavailable' }).waitFor();
  assert.deepEqual(await evidence(), before, 'Unavailable assessment must award no course or grammar progress');
  assert.equal(await page.getByText('Turn 1 of 3', { exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Next conversational turn', exact: true }).count(), 0);
  assert.equal(assessmentRequests.at(-1).exercise.evaluationMode, 'open-goal');
  assert.equal(assessmentRequests.at(-1).answer, typed);
  assert.equal(await page.locator('#course-answer').inputValue(), typed);
  failAssessment = false;
  await page.getByRole('button', { name: 'Assess typed practice', exact: true }).click();
  await page.getByRole('heading', { name: 'That works in this conversation.', exact: true }).waitFor();
  const typedSaved = await evidence();
  assert.equal(typedSaved.course.length, before.course.length + 1);
  assert.equal(typedSaved.course.at(-1).spoken, false, 'Typed practice must not become spoken evidence');
  assert.equal(typedSaved.logs.at(-1).answer, typed, 'Keep the accepted alternative');
  assert.equal(await page.locator('#course-answer').inputValue(), typed);
  assert.equal(await page.getByText('Turn 1 of 3', { exact: true }).count(), 1, 'Do not auto-advance while learner reads feedback');
  await page.reload();
  await page.getByRole('heading', { name: 'That works in this conversation.', exact: true }).waitFor();
  assert.equal(await page.locator('#course-answer').inputValue(), typed, 'Reload preserves the assessed response');
  assert.deepEqual(await evidence(), typedSaved, 'Reload of marked turn must not duplicate evidence');
  assert.equal(assessmentRequests.length, 2, 'Reload must not resubmit the assessment');
  await page.getByRole('button', { name: 'Next conversational turn', exact: true }).click();
  await page.getByText('Turn 2 of 3', { exact: true }).waitFor();
  await page.waitForFunction(() => window.scrollY === 0);
  const nextTurnTop = await page.locator('.course-turn-top').boundingBox();
  assert.ok(nextTurnTop && nextTurnTop.y >= 0 && nextTurnTop.y < 844, 'Next turn must bring its prompt back into the mobile viewport');
  assert.equal(await page.locator('.course-turn').count(), 1);
  assert.equal(await page.locator('#course-answer').inputValue(), '');
  assert.equal(await page.getByText('One possible answer', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Record answer', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor();
  await page.waitForTimeout(1500);
  assert.ok(parseFloat(await page.getByLabel('Recording duration').innerText()) >= 1);
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await page.waitForFunction((text) => document.querySelector('#course-answer')?.value === text, recognised);
  assert.equal(transcriptionRequests, 1);
  assert.equal(assessmentRequests.length, 2, 'ASR must not mark the spoken response');
  assert.deepEqual(await evidence(), typedSaved);
  await page.locator('audio').waitFor();
  await page.locator('#course-answer').fill(confirmed);
  await page.locator('#course-flow').selectOption('fluent');
  await page.getByRole('button', { name: 'Confirm transcript and assess', exact: true }).click();
  await page.getByRole('heading', { name: 'That works in this conversation.', exact: true }).waitFor();
  const spokenSaved = await evidence();
  assert.equal(assessmentRequests.at(-1).exercise.evaluationMode, 'open-goal');
  assert.equal(assessmentRequests.at(-1).answer, confirmed);
  assert.equal(spokenSaved.course.length, typedSaved.course.length + 1);
  assert.equal(spokenSaved.course.find(item => item.answer === confirmed).spoken, true);
  assert.equal(spokenSaved.course.find(item => item.answer === confirmed).flow, 'fluent');
  assert.ok(spokenSaved.skills.every((item) => item.fastSpokenSuccesses === 0));
  await page.getByRole('button', { name: 'Next conversational turn', exact: true }).click();
  await page.getByText('Turn 3 of 3', { exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/olingo-course-turn-mobile.png', fullPage: true });
  await assertNoOverflow('Final turn mobile');
  recognised = 'Ti va di prendere un caffè insieme?';
  await page.getByRole('button', { name: 'Record answer', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await page.waitForFunction((text) => document.querySelector('#course-answer')?.value === text, recognised);
  await page.getByRole('button', { name: 'Give me a cue', exact: true }).click();
  await page.locator('.course-hint').waitFor();
  await page.reload();
  await page.waitForFunction((text) => document.querySelector('#course-answer')?.value === text, recognised);
  await page.locator('.course-hint').waitFor();
  assert.equal(assessmentRequests.length, 3, 'Hint and reload must not trigger marking');
  await page.getByRole('button', { name: 'Confirm transcript and assess', exact: true }).click();
  await page.getByRole('heading', { name: 'That works in this conversation.', exact: true }).waitFor();
  const hintedSaved = await evidence();
  assert.equal(hintedSaved.course.length, 3);
  assert.equal(hintedSaved.course.find(item => item.answer === recognised).hintsUsed, 1, 'Cue shown after capture must remain assisted evidence after reload');
  assert.equal(hintedSaved.course.find(item => item.answer === recognised).spoken, true);
  await page.getByRole('button', { name: 'Finish this episode', exact: true }).click();
  await page.getByText('Episode complete', { exact: true }).waitFor();
  assert.equal(await page.locator('#course-answer').count(), 0);

  assert.deepEqual(pageErrors, []);
  console.log(`PASS: ${process.env.OLINGO_SMOKE_LEVELS || 'A1–C2'} levels with 12 strands each, desktop/mobile layout, one turn, hidden examples, typed alternative/open-goal payload, outage without advancement or progress, explicit next turn, real recording and transcript confirmation, separate typed/spoken evidence, assessed reload, persisted post-recording hint. `);
} finally {
  await context.close();
  await browser.close();
  await localServer?.close();
  await rm(testDir, { recursive: true, force: true });
}
