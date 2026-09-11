const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { download } = require('./model-download');

async function installManagedModel(root, asset, signal, progress, defaultPath) {
  fs.mkdirSync(root, { recursive: true });
  const indexFile = path.join(root, 'models.json');
  const file = defaultPath || path.join(root, (asset.sha || asset.key) + '.gguf');
  let result;
  if (!fs.existsSync(file)) result = await download(asset, file, signal, progress);
  else {
    const hash = crypto.createHash('sha256');
    let prefix = Buffer.alloc(0), size = 0;
    for await (const chunk of fs.createReadStream(file)) {
      signal.throwIfAborted(); size += chunk.length; hash.update(chunk);
      if (prefix.length < 4) prefix = Buffer.concat([prefix, chunk.subarray(0, 4 - prefix.length)]);
    }
    result = { size, sha: hash.digest('hex') };
    if (prefix.toString() !== 'GGUF' || asset.sha && asset.sha !== result.sha || asset.size && asset.size !== size) throw new Error('Existing model verification failed');
  }
  signal.throwIfAborted();
  let index = {};
  try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw new Error('Cannot read the managed model index'); }
  index[asset.id] = { file: path.basename(file), size: result.size, sha256: result.sha, verified: !!asset.sha, displayName: asset.name, source: 'catalog' };
  const pending = indexFile + '.tmp';
  fs.writeFileSync(pending, JSON.stringify(index, null, 2));
  fs.renameSync(pending, indexFile);
  return index[asset.id];
}

module.exports = { installManagedModel };
