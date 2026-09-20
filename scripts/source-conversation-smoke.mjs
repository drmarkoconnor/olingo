/**
 * Browser integration smoke for Sources → conversation provenance handoff.
 * Run node scripts/source-conversation-smoke.mjs --serve (starts local Vite),
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
const uid = 'local-source-handoff-smoke';
await context.addInitScript(id => localStorage.setItem('olingo.localUid', id), uid);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const requests = [];
const source = { id: 'smoke-garden-source', sourceName: 'Village Gazette', title: 'Un nuovo giardino condiviso', link: 'https://example.org/community-garden', topic: 'culture', prompt: 'Che cosa pensi di un giardino condiviso?', publishedAt: '2026-09-20T08:00:00Z' };
const reader = {
  id: 'smoke-adapted-reader', title: source.title, sourceName: source.sourceName, sourceUrl: source.link,
  level: 'A1', provider: 'openai', sourceMaterial: 'article', publishedAt: source.publishedAt,
  paragraphs: [
    { italian: 'Il paese prepara un giardino condiviso.', english: 'The village is preparing a shared garden.' },
    { italian: 'I vicini possono piantare fiori e incontrarsi il sabato.', english: 'Neighbours can plant flowers and meet on Saturdays.' },
  ],
  glossary: [{ italian: 'giardino', english: 'garden' }], discussionPrompt: 'Ti piace questa idea?',
};
const expectedSource = { label: `${reader.sourceName}: ${reader.title} (adapted reading)`, url: reader.sourceUrl, excerpt: reader.paragraphs.map(item => item.italian).join('\n') };
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/session') return route.fulfill({ json: { user: { id: uid } } });
  if (path === '/api/italian-sources') return route.fulfill({ json: { items: [source] } });
  if (path === '/api/source-reader') {
    assert.equal(route.request().postDataJSON().sourceItem.id, source.id, 'Reader must use the selected source');
    return route.fulfill({ json: reader });
  }
  if (path === '/api/generate-conversation') {
    const body = route.request().postDataJSON(); requests.push(body);
    const level = body.lessonId.split('-')[1].toUpperCase();
    return route.fulfill({ json: { provider: 'openai', generationId: 'source-smoke-generation', episode: {
      id: 'source-smoke-episode', lessonId: body.lessonId, level, canDo: 'Talk about a shared garden.',
      title: 'Meeting at the new garden', context: 'Imagine you meet a neighbour near the planned shared garden.', situationKey: 'source-garden-meeting',
      turns: [1, 2, 3].map(index => ({ id: `${body.lessonId}-${index}`, npcLine: 'Ciao, ti piace questo giardino?', instruction: 'Say whether you like the garden.', example: 'Sì, mi piace molto.', hint: 'Give a short opinion.' })),
      source: body.source, interests: body.interests, createdAt: new Date().toISOString(),
    } } });
  }
  return route.fulfill({ status: 503, json: { error: 'Disabled in source handoff smoke' } });
});
try {
  await page.goto(`${baseURL}/conversations`);
  await page.getByRole('heading', { name: 'Italian for things you want to say.', exact: true }).waitFor();
  await page.getByRole('button', { name: 'A1', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.course-levels button[aria-pressed="true"]')?.textContent === 'A1');
  await page.getByText('Bring your interests or a source', { exact: true }).click();
  await page.locator('#course-interests').fill('Gardening, jazz');
  await page.locator('#course-interests').blur();
  await page.waitForFunction(async () => { const { db } = await import('/src/storage/db.ts'); return (await db.conversationDocuments.toArray()).some(item => item.kind === 'profile' && item.payload.interests?.includes('jazz')); });
  await page.getByRole('link', { name: 'Sources', exact: true }).click();
  await page.getByRole('heading', { name: source.title, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open newspaper', exact: true }).click();
  await page.getByRole('button', { name: 'Discuss this in Conversations', exact: true }).click();
  await page.getByRole('heading', { name: 'Italian for things you want to say.', exact: true }).waitFor();
  await page.getByText('Bring your interests or a source', { exact: true }).click();
  assert.equal(await page.locator('#course-source-label').inputValue(), expectedSource.label);
  assert.equal(await page.locator('#course-source-url').inputValue(), expectedSource.url);
  assert.equal(await page.locator('#course-source-text').inputValue(), expectedSource.excerpt);
  assert.equal(await page.locator('#course-interests').inputValue(), 'Gardening, jazz');
  await page.getByRole('button', { name: 'Start a fresh conversation', exact: true }).click();
  await page.getByRole('heading', { name: 'Meeting at the new garden', exact: true }).waitFor();
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].source, expectedSource, 'Generation must receive the adapted Italian text, attribution and source URL intact');
  assert.deepEqual(requests[0].interests, ['Gardening', 'jazz']);
  await page.getByText(`Based on: ${expectedSource.label}`, { exact: true }).click();
  assert.equal(await page.locator('.course-source-provenance p').innerText(), expectedSource.excerpt);
  assert.equal(await page.getByRole('link', { name: 'Open source', exact: true }).getAttribute('href'), expectedSource.url);
  assert.equal(await page.getByText('One possible answer', { exact: true }).count(), 0);
  await page.screenshot({ path: '/tmp/olingo-source-conversation-handoff.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: actual Sources reader button prefills adapted Italian source and attribution; interests persist; fresh request preserves source label, URL, excerpt and interests; generated turn displays attributed source.');
} catch (error) {
  console.error('PAGE ERRORS:', errors);
  console.error((await page.locator('body').innerText().catch(() => '')).slice(-3000));
  throw error;
} finally {
  await context.close(); await browser.close(); await localServer?.close();
  await rm(testDir, { recursive: true, force: true });
}
