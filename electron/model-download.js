const fs = require('fs');
const crypto = require('crypto');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

async function download(asset, destination, signal, progress = () => {}) {
  const part = destination + '.part', metadataFile = part + '.json';
  let completed = fs.existsSync(part) ? fs.statSync(part).size : 0;
  let total = Number.isSafeInteger(asset.size) && asset.size > 0 ? asset.size : null;
  let metadata = {};
  try { metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8')); } catch {}
  const discard = () => { for (const file of [part, metadataFile]) if (fs.existsSync(file)) fs.unlinkSync(file); };
  // A catalog hash protects resumed bytes. Unhashed custom files need a server validator.
  if (completed && (!asset.sha && (metadata.url !== asset.url || !metadata.validator) || total && completed > total)) {
    discard(); completed = 0;
  }
  if (total === null || completed < total) {
    const headers = { 'Accept-Encoding': 'identity' };
    if (completed) {
      headers.Range = `bytes=${completed}-`;
      if (metadata.validator) headers['If-Range'] = metadata.validator;
    }
    const response = await fetch(asset.url, { signal, headers });
    if (response.status === 416 && completed) {
      await response.body?.cancel(); discard();
      return download(asset, destination, signal, progress);
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Download failed: HTTP ${response.status}`); }
    const etag = response.headers.get('etag');
    const validator = etag && !etag.startsWith('W/') ? etag : response.headers.get('last-modified');
    if (response.status === 206) {
      const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '');
      if (!range || Number(range[1]) !== completed || Number(range[2]) < completed || Number(range[2]) >= Number(range[3]) || !Number.isSafeInteger(Number(range[3])) || total !== null && Number(range[3]) !== total) {
        await response.body?.cancel(); throw new Error('Invalid download range');
      }
      if (completed && !asset.sha && validator && metadata.validator !== validator) {
        await response.body?.cancel(); discard(); throw new Error('The remote file changed. Retry to download the new file.');
      }
      total = Number(range[3]);
    } else {
      completed = 0;
      const length = Number(response.headers.get('content-length'));
      if (total === null && Number.isSafeInteger(length) && length > 0) total = length;
    }
    fs.writeFileSync(metadataFile, JSON.stringify({ url: asset.url, validator, total }));
    let prefix = Buffer.alloc(0), invalid = false, lastUpdate = 0;
    if (asset.gguf && completed) {
      const fd = fs.openSync(part, 'r'), buffer = Buffer.alloc(4);
      try { prefix = buffer.subarray(0, fs.readSync(fd, buffer, 0, Math.min(4, completed), 0)); } finally { fs.closeSync(fd); }
    }
    const meter = new Transform({ transform(chunk, encoding, callback) {
      completed += chunk.length;
      if (asset.gguf && prefix.length < 4) prefix = Buffer.concat([prefix, chunk.subarray(0, 4 - prefix.length)]);
      if (asset.gguf && prefix.length === 4 && prefix.toString() !== 'GGUF') { invalid = true; return callback(new Error('Invalid GGUF file (magic bytes). Use the direct file download URL.')); }
      if (total !== null && completed > total) { invalid = true; return callback(new Error('Download exceeds the expected file size')); }
      if (Date.now() - lastUpdate > 200) { progress(completed, total || 0); lastUpdate = Date.now(); }
      callback(null, chunk);
    } });
    const append = completed > 0;
    try {
      await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(part, { flags: append ? 'a' : 'w' }), { signal });
    } catch (error) { if (invalid) discard(); throw error; }
  }
  signal.throwIfAborted();
  const hash = crypto.createHash('sha256');
  let prefix = Buffer.alloc(0);
  for await (const chunk of fs.createReadStream(part)) {
    signal.throwIfAborted(); hash.update(chunk);
    if (prefix.length < 4) prefix = Buffer.concat([prefix, chunk.subarray(0, 4 - prefix.length)]);
  }
  const sha = hash.digest('hex');
  if (total !== null && completed !== total || asset.sha && sha !== asset.sha || asset.gguf && prefix.toString() !== 'GGUF') {
    discard(); throw new Error('Download verification failed. Please retry.');
  }
  fs.renameSync(part, destination);
  if (fs.existsSync(metadataFile)) fs.unlinkSync(metadataFile);
  progress(completed, completed);
  return { size: completed, sha };
}

module.exports = { download };
