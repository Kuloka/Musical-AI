const test = require('node:test');
const assert = require('node:assert/strict');
const { registryAsset } = require('../electron/local-runtime');

test('registry download validates names, model layers and integrity metadata', async () => {
  await assert.rejects(registryAsset('musical:../bad:model', new AbortController().signal), /Invalid model name/);
  const previous = global.fetch;
  try {
    let manifest = { layers: [{ mediaType: 'application/vnd.ollama.image.model', digest: 'sha256:' + 'a'.repeat(64), size: 123 }] };
    global.fetch = async url => {
      assert.equal(url, 'https://registry.ollama.ai/v2/library/qwen2.5/manifests/0.5b');
      return Response.json(manifest);
    };
    const asset = await registryAsset('musical:qwen2.5:0.5b', new AbortController().signal);
    assert.equal(asset.sha, 'a'.repeat(64));
    assert.equal(asset.size, 123);
    assert.equal(asset.url, 'https://registry.ollama.ai/v2/library/qwen2.5/blobs/sha256:' + 'a'.repeat(64));
    manifest.layers.push({ mediaType: 'application/vnd.ollama.image.projector' });
    await assert.rejects(registryAsset('musical:qwen2.5:0.5b'), /additional components/);
    manifest = { layers: [{ mediaType: 'application/vnd.ollama.image.model', digest: '../file', size: 123 }] };
    await assert.rejects(registryAsset('musical:qwen2.5:0.5b'), /Invalid model manifest/);
  } finally { global.fetch = previous; }
});
