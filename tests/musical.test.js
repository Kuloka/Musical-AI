const test = require('node:test');
const assert = require('node:assert/strict');
const { runTeam, chatFetch } = require('../musical-ai');
const { download } = require('../electron/local-runtime');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const messages = [{ role: 'user', content: 'Design a UI and explain its data model.' }];
const answer = content => Response.json({ message: { content } });

test('planner splits one request, workers overlap, synthesis receives both drafts', async () => {
  let active = 0, maxActive = 0;
  const result = await runTeam({ messages, model: 'main', workerModels: ['ui-model', 'data-model'], concurrency: 2, signal: new AbortController().signal, onUpdate() {},
    request: async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.format) return answer(JSON.stringify({ tasks: [{ title: 'UI', task: 'Design UI' }, { title: 'Data', task: 'Design data' }] }));
      active++; maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 15)); active--;
      return answer(`Draft from ${body.model}`);
    }
  });
  assert.equal(maxActive, 2);
  assert.match(result.context, /Draft from ui-model/);
  assert.match(result.context, /Draft from data-model/);
  assert.ok(result.rows.every(row => row.status === 'done'));
});

test('simple question skips workers', async () => {
  let calls = 0;
  const result = await runTeam({ messages, model: 'main', signal: new AbortController().signal, onUpdate() {}, request: async () => { calls++; return answer('{"tasks":[]}'); } });
  assert.equal(calls, 1); assert.equal(result.context, '');
});

test('failed specialist is visible and excluded from the final drafts', async () => {
  const result = await runTeam({ messages, model: 'main', signal: new AbortController().signal, onUpdate() {}, request: async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.format) return answer('{"tasks":[{"title":"A","task":"A"},{"title":"B","task":"B"}]}');
    if (body.messages.at(-1).content.endsWith('A')) return new Response('Out of memory', { status: 500 });
    return answer('Useful draft B');
  } });
  assert.equal(result.rows[1].status, 'error');
  assert.match(result.context, /Useful draft B/); assert.doesNotMatch(result.context, /Out of memory/);
});

test('stop aborts active requests and marks waiting workers stopped', async () => {
  const controller = new AbortController(); let rows;
  await assert.rejects(runTeam({ messages, model: 'main', concurrency: 1, signal: controller.signal, onUpdate: value => { rows = value; }, request: async (_url, init) => {
    if (JSON.parse(init.body).format) return answer('{"tasks":[{"title":"A","task":"A"},{"title":"B","task":"B"}]}');
    setTimeout(() => controller.abort(), 10);
    return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  } }), { name: 'AbortError' });
  assert.equal(rows[1].status, 'stopped'); assert.equal(rows[2].status, 'stopped');
});

test('embedded streaming adapter preserves split UTF-8 and SSE boundaries', async () => {
  const original = global.fetch;
  const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Привет"}}]}\n\ndata: [DONE]\n\n');
  global.fetch = async () => new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); } }));
  try {
    const response = await chatFetch('', { body: JSON.stringify({ model: 'musical:test', messages, stream: true }) });
    assert.equal(JSON.parse((await response.text()).trim()).message.content, 'Привет');
  } finally { global.fetch = original; }
});

test('download resumes partial bytes, verifies SHA256, and rejects corrupt content', async () => {
  const content = Buffer.from('A verified runtime archive');
  let range;
  const server = http.createServer((req, res) => {
    range = req.headers.range;
    const start = range ? Number(range.match(/\d+/)[0]) : 0;
    res.writeHead(start ? 206 : 200, { ...(start ? { 'Content-Range': `bytes ${start}-${content.length - 1}/${content.length}` } : {}) });
    res.end(content.subarray(start));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'musical-download-test-'));
  const destination = path.join(dir, 'archive');
  const asset = { url: `http://127.0.0.1:${server.address().port}`, size: content.length, sha: crypto.createHash('sha256').update(content).digest('hex') };
  try {
    fs.writeFileSync(destination + '.part', content.subarray(0, 5));
    await download(asset, destination, new AbortController().signal, () => {});
    assert.equal(range, 'bytes=5-'); assert.deepEqual(fs.readFileSync(destination), content);
    await assert.rejects(download({ ...asset, sha: 'bad' }, destination, new AbortController().signal, () => {}), /verification failed/);
    assert.ok(!fs.existsSync(destination + '.part'));
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    // Only remove the two explicitly created files and their own temporary directory.
    if (fs.existsSync(destination)) fs.unlinkSync(destination);
    if (fs.existsSync(destination + '.part')) fs.unlinkSync(destination + '.part');
    fs.rmdirSync(dir);
  }
});
