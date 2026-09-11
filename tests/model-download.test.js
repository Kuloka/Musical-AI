const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { download } = require('../electron/model-download');
const { catalog, catalogAsset, validateCatalog } = require('../electron/model-catalog');
const { installManagedModel } = require('../electron/managed-models');

const hash = content => crypto.createHash('sha256').update(content).digest('hex');
const gguf = Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(65532, 42)]);

async function fixture(t, handler) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multimind-gguf-'));
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { dir, url: `http://127.0.0.1:${server.address().port}/model.gguf`, signal: new AbortController().signal };
}

test('catalog contains five new families in both quants with pinned integrity metadata', () => {
  validateCatalog(catalog);
  assert.equal(catalog.models.length, 11);
  const families = new Map();
  for (const model of catalog.models) {
    assert.match(model.url, /\/resolve\/[a-f0-9]{40}\//);
    const quants = families.get(model.name) || new Set();
    quants.add(model.quantization);
    families.set(model.name, quants);
    assert.equal(catalogAsset(model.id).sha, model.sha256);
  }
  assert.equal([...families.values()].filter(quants => quants.has('Q4_K_M') && quants.has('Q8_0')).length, 5);
  assert.throws(() => catalogAsset('multimind:unknown'), /Unknown/);
  const invalid = structuredClone(catalog);
  delete invalid.models[1].sha256;
  assert.throws(() => validateCatalog(invalid), /Invalid/);
});

test('catalog model resumes, verifies SHA256 and enters the managed index atomically', async t => {
  let range;
  const { dir, url, signal } = await fixture(t, (req, res) => {
    range = req.headers.range;
    const start = Number(range?.match(/\d+/)?.[0] || 0);
    res.writeHead(start ? 206 : 200, { ...(start ? { 'Content-Range': `bytes ${start}-${gguf.length - 1}/${gguf.length}` } : {}) });
    res.end(gguf.subarray(start));
  });
  const asset = { ...catalogAsset(catalog.defaultModel), id: 'multimind:test', url, size: gguf.length, sha: hash(gguf) };
  fs.writeFileSync(path.join(dir, 'models.json'), JSON.stringify({ existing: { file: 'legacy' } }));
  fs.writeFileSync(path.join(dir, asset.sha + '.gguf.part'), gguf.subarray(0, 11));
  const result = await installManagedModel(dir, asset, signal, () => {});
  assert.equal(range, 'bytes=11-');
  assert.equal(result.verified, true);
  assert.equal(result.sha256, hash(gguf));
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'models.json')));
  assert.equal(index.existing.file, 'legacy');
  assert.equal(index['multimind:test'].source, 'catalog');
});

for (const mode of ['bad-magic', 'wrong-hash', 'truncated']) {
  test(`invalid catalog file never enters the managed index: ${mode}`, async t => {
    const bytes = mode === 'bad-magic' ? Buffer.from('<html>not a model</html>') : mode === 'truncated' ? Buffer.from('GG') : gguf;
    const { dir, url, signal } = await fixture(t, (_req, res) => res.end(bytes));
    const asset = {
      id: 'multimind:test',
      name: 'Test',
      url,
      size: bytes.length,
      sha: mode === 'wrong-hash' ? '0'.repeat(64) : hash(bytes),
      gguf: true
    };
    await assert.rejects(installManagedModel(dir, asset, signal, () => {}), /GGUF|verification failed/);
    assert.equal(fs.existsSync(path.join(dir, 'models.json')), false);
    assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.gguf') || name.endsWith('.part')), false);
  });
}

test('incorrect Content-Range cannot append to a partial catalog model', async t => {
  const { dir, url, signal } = await fixture(t, (_req, res) => {
    res.writeHead(206, { 'Content-Range': `bytes 2-${gguf.length - 1}/${gguf.length}` });
    res.end(gguf.subarray(2));
  });
  const destination = path.join(dir, 'model.gguf');
  fs.writeFileSync(destination + '.part', gguf.subarray(0, 11));
  await assert.rejects(download({ url, sha: hash(gguf), size: gguf.length, gguf: true }, destination, signal), /Invalid download range/);
  assert.equal(fs.statSync(destination + '.part').size, 11);
});
