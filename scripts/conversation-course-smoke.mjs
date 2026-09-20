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
const uid = 'local-conversation-smoke';
await context.addInitScript((id) => localStorage.setItem('olingo.localUid', id), uid);
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
const generationRequests = [];
const assessmentRequests = [];
let transcriptionRequests = 0;
let syncRequests = 0;
let failEpisode = false;
let failFollowUp = false;
let failAssessment = false;
const remoteAttempts = new Map();
const remoteDocuments = new Map();
const recognised = 'Sto bene, e tu?';
const confirmed = 'Bene, grazie! Tu come stai?';
const lessonId = 'conversation-a1-social';
const turns = [
  { id: `${lessonId}-1`, npcLine: 'Ciao, sono Elisa. E tu?', instruction: 'Greet Elisa and introduce yourself as Alex.', example: 'Ciao Elisa, mi chiamo Alex.', hint: 'A greeting and your name are enough.' },
  { id: `${lessonId}-2`, npcLine: 'Piacere, Alex! Come stai?', instruction: 'Say you are well and ask how Elisa is.', example: 'Sto bene, grazie. E tu?', hint: 'Return a friendly question.' },
  { id: `${lessonId}-3`, npcLine: 'Anch’io, grazie. Hai un po’ di tempo?', instruction: 'Suggest having a coffee together.', example: 'Prendiamo un caffè insieme?', hint: 'Offer a simple invitation.' },
];
const episode = { id: 'smoke-fresh-episode', lessonId, level: 'A1', canDo: 'Greet, introduce and invite.', title: 'An unexpected meeting at the bookshop', context: 'You meet someone at a village bookshop.', situationKey: 'village-bookshop-new-friend', turns, createdAt: new Date().toISOString() };
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/session') return route.fulfill({ json: { user: { id: uid } } });
  if (url.pathname === '/api/conversation-history') {
    syncRequests++;
    const syncedAt = new Date().toISOString();
    if (route.request().method() === 'POST') {
      const { attempts = [], documents = [] } = route.request().postDataJSON();
      for (const attempt of attempts) remoteAttempts.set(attempt.id, attempt);
      for (const document of documents) remoteDocuments.set(`${document.kind}:${document.id}`, document);
      return route.fulfill({ json: { userId: uid, attempts, documents, syncedAt } });
    }
    return route.fulfill({ json: { userId: uid, records: [...(url.searchParams.get('kind') === 'attempts' ? remoteAttempts : remoteDocuments).values()], nextCursor: null, syncedAt } });
  }
  if (url.pathname === '/api/generate-conversation') {
    const body = route.request().postDataJSON();
    generationRequests.push(body);
    if (body.mode === 'episode') {
      if (failEpisode) return route.fulfill({ status: 503, json: { error: 'Fresh generation is unavailable for this test.' } });
      return route.fulfill({ json: { provider: 'openai', generationId: 'smoke-generation', episode: { ...episode, interests: body.interests } } });
    }
    if (failFollowUp) return route.fulfill({ status: 503, json: { error: 'Follow-up generation is unavailable. Your assessed answer is saved.' } });
    return route.fulfill({ json: { provider: 'openai', generationId: 'smoke-follow-up', lessonId: body.lessonId, episodeId: body.episodeId, turn: turns[body.turnIndex] } });
  }
  if (url.pathname === '/api/transcribe-speech') {
    transcriptionRequests++;
    return route.fulfill({ json: { transcript: recognised, provider: 'openai' } });
  }
  if (url.pathname === '/api/evaluate-answer') {
    const body = route.request().postDataJSON();
    assessmentRequests.push(body);
    if (failAssessment) return route.fulfill({ status: 503, json: { error: 'Assessment is unavailable. Your answer has not been scored.' } });
    return route.fulfill({ json: { exerciseValid: true, invalidReason: '', accepted: true, communicative: true, correctedItalian: body.exercise.targetItalian, meaning: body.exercise.promptEnglish, errorTags: [], shortFeedback: 'Your alternative fits this conversation.', repairPrompts: [], confidence: .97, provider: 'openai', status: 'assessed' } });
  }
  return route.fulfill({ status: 503, json: { error: 'Disabled in isolated browser smoke' } });
});
async function evidence() {
  return page.evaluate(async () => {
    const { db } = await import('/src/storage/db.ts');
    return JSON.parse(JSON.stringify({ course: (await db.courseAttempts.toArray()).map(({ syncedAt, ...attempt }) => attempt), logs: await db.exerciseLogs.toArray(), mistakes: await db.mistakes.toArray() }));
  });
}
async function assertNoOverflow(label) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(sizes.scroll <= sizes.width + 1, `${label}: page width ${sizes.scroll} overflows viewport ${sizes.width}`);
}
async function enableCloudMock() {
  await page.evaluate(async () => {
    const { useAuth } = await import('/src/store/useAuth.ts');
    useAuth.setState({ localMode: false });
  });
  await page.getByText('Conversation history synced to your account.', { exact: true }).first().waitFor();
}
try {
  await page.goto(`${baseURL}/conversations`);
  await page.getByRole('heading', { name: 'Italian for things you want to say.', exact: true }).waitFor();
  await enableCloudMock();
  const browse = page.getByText('Browse all conversational goals', { exact: true });
  assert.equal(await browse.evaluate(node => node.parentElement.open), false, 'Goals are collapsed at entry');
  assert.equal(await page.locator('.course-card').count(), 12);
  assert.equal(await page.locator('.course-card').first().isVisible(), false);
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    await page.getByRole('button', { name: level, exact: true }).click();
    await page.waitForFunction(level => document.querySelector(`.course-levels button[aria-pressed="true"]`)?.textContent === level, level);
    assert.equal(await page.locator('.conversation-garden__bed').count(), 12);
    await assertNoOverflow(`${level} desktop`);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoOverflow(`${level} mobile`);
    await page.setViewportSize({ width: 1280, height: 1050 });
  }
  await page.getByRole('button', { name: 'Continue at C2', exact: true }).click();
  assert.equal(await page.getByLabel('Level guidance').count(), 0, 'Level guidance must be dismissible');
  assert.equal(await page.getByRole('button', { name: 'C2', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'A1', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.course-levels button[aria-pressed="true"]')?.textContent === 'A1');
  await page.getByText('Bring your interests or a source', { exact: true }).click();
  await page.locator('#course-interests').fill('Gardening, jazz');
  await page.locator('#course-interests').blur();
  failEpisode = true;
  await page.getByRole('button', { name: 'Start a fresh conversation', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Fresh generation is unavailable' }).waitFor();
  assert.equal(await page.locator('.course-turn').count(), 0, 'Generation failure must not silently substitute content');
  await page.getByRole('button', { name: 'Use an authored episode', exact: true }).click();
  await page.getByText('A1 · Authored conversation', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Return to pathway', exact: true }).click();
  failEpisode = false;
  await page.getByRole('button', { name: 'Start a fresh conversation', exact: true }).click();
  await page.getByRole('heading', { name: episode.title, exact: true }).waitFor();
  assert.deepEqual(generationRequests.at(-1).interests, ['Gardening', 'jazz']);
  assert.equal(await page.locator('.course-turn').count(), 1);
  assert.equal(await page.getByText('One possible answer', { exact: true }).count(), 0);
  const typed = 'Ciao Elisa! Sono Alex, piacere.';
  await page.locator('#course-answer').fill(typed);
  const before = await evidence();
  failAssessment = true;
  await page.getByRole('button', { name: 'Assess typed practice', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Assessment is unavailable' }).waitFor();
  assert.deepEqual(await evidence(), before, 'No progress on assessment outage');
  failAssessment = false;
  await page.getByRole('button', { name: 'Assess typed practice', exact: true }).click();
  await page.getByRole('heading', { name: 'That works in this conversation.', exact: true }).waitFor();
  assert.equal(assessmentRequests.at(-1).exercise.evaluationMode, 'open-goal');
  const typedSaved = await evidence();
  failFollowUp = true;
  await page.getByRole('button', { name: 'Next conversational turn', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Follow-up generation is unavailable' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'That works in this conversation.', exact: true }).count(), 1);
  assert.equal(await page.getByText('Turn 1 of 3', { exact: true }).count(), 1);
  assert.equal(await page.locator('#course-answer').inputValue(), typed);
  assert.deepEqual(await evidence(), typedSaved, 'Generation failure retains assessed evidence unchanged');
  assert.deepEqual(generationRequests.at(-1).history, [{ role: 'partner', text: turns[0].npcLine }, { role: 'learner', text: typed }]);
  await page.reload();
  await page.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
  assert.ok((await page.locator('.conversation-recap').innerText()).includes(typed));
  await page.getByRole('button', { name: 'Resume unfinished conversation', exact: true }).click();
  await page.getByRole('heading', { name: 'That works in this conversation.', exact: true }).waitFor();
  assert.equal(await page.locator('#course-answer').inputValue(), typed);
  assert.deepEqual(await evidence(), typedSaved);
  failFollowUp = false;
  await page.getByRole('button', { name: 'Next conversational turn', exact: true }).click();
  await page.getByText('Turn 2 of 3', { exact: true }).waitFor();
  await page.waitForFunction(() => window.scrollY === 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow('Generated turn mobile');
  await page.getByRole('button', { name: 'Record answer', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await page.waitForFunction(text => document.querySelector('#course-answer')?.value === text, recognised);
  assert.equal(transcriptionRequests, 1);
  assert.equal(assessmentRequests.length, 2, 'ASR must not assess before confirmation');
  await page.locator('#course-answer').fill(confirmed);
  await page.getByRole('button', { name: 'Confirm transcript and assess', exact: true }).click();
  await page.getByRole('heading', { name: 'That works in this conversation.', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Next conversational turn', exact: true }).click();
  await page.getByText('Turn 3 of 3', { exact: true }).waitFor();
  assert.equal(generationRequests.at(-1).history.at(-1).text, confirmed, 'Follow-up must use actual confirmed wording');
  assert.equal(generationRequests.at(-1).history.length, 4);
  await page.locator('#course-answer').fill('Ti va di prendere un caffè insieme?');
  await page.getByRole('button', { name: 'Assess typed practice', exact: true }).click();
  await page.getByRole('heading', { name: 'That works in this conversation.', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Finish this episode', exact: true }).click();
  await page.getByText('Episode complete', { exact: true }).waitFor();
  assert.equal((await evidence()).course.length, 3);
  await page.reload();
  await page.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
  assert.ok((await page.locator('.conversation-recap').innerText()).includes('Episode completed'));
  await page.getByRole('button', { name: 'Continue to my pathway', exact: true }).click();
  await enableCloudMock();
  assert.ok(syncRequests > 0);
  await page.waitForFunction(async () => { const { db } = await import('/src/storage/db.ts'); return (await db.courseAttempts.toArray()).every(item => Boolean(item.syncedAt)); });
  assert.equal(remoteAttempts.size, 3, 'Complete course evidence synced once by immutable ID');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/olingo-fresh-course-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 1050 });
  await page.screenshot({ path: '/tmp/olingo-fresh-course-desktop.png', fullPage: true });
  assert.deepEqual(pageErrors, []);
  console.log('PASS: fresh generation and explicit authored fallback; A1–C2 garden and optional warnings; collapsed goals; responsive layout; confirmed-answer-dependent follow-ups; assessment/generation outages; recap/resume; real capture confirmation; matching-user cloud history sync.');
} catch (error) {
  await page.screenshot({ path: '/tmp/olingo-course-failure.png', fullPage: true }).catch(() => {});
  console.error('PAGE ERRORS:', pageErrors);
  console.error((await page.locator('body').innerText().catch(() => '')).slice(-4000));
  throw error;
} finally {
  await context.close(); await browser.close(); await localServer?.close();
  await rm(testDir, { recursive: true, force: true });
}
