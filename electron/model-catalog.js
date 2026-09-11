const catalog = require('../models-catalog.json');

function validateCatalog(value) {
  if (value.schemaVersion !== 1 || !Array.isArray(value.models) || !value.models.length) throw new Error('Invalid model catalog');
  const ids = new Set();
  for (const model of value.models) {
    if (!/^multimind:[a-z0-9][a-z0-9:._-]*$/.test(model.id) || ids.has(model.id) ||
        !model.name || !model.family || !model.quantization ||
        !Number.isSafeInteger(model.sizeBytes) || model.sizeBytes < 4 ||
        !/^[a-f0-9]{64}$/.test(model.sha256) ||
        !Number.isFinite(model.ramGiB) || model.ramGiB <= 0 ||
        !Number.isFinite(model.minRamGiB) || model.minRamGiB < model.ramGiB ||
        !['low', 'balanced', 'powerful'].includes(model.recommendation)) throw new Error('Invalid model catalog entry: ' + model.id);
    const url = new URL(model.url);
    if (url.protocol !== 'https:' || !url.pathname.toLowerCase().endsWith('.gguf') || url.username || url.password) throw new Error('Invalid catalog URL');
    ids.add(model.id);
  }
  if (!ids.has(value.defaultModel)) throw new Error('Missing default model');
  return value;
}
validateCatalog(catalog);

function catalogAsset(id) {
  const model = catalog.models.find(model => model.id === id);
  if (!model) throw new Error('Unknown built-in catalog model');
  return { ...model, url: model.url, size: model.sizeBytes, sha: model.sha256, gguf: true };
}

module.exports = { catalog, validateCatalog, catalogAsset };
