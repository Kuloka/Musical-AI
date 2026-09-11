// Managed, optional CPU runtime. Downloads are pinned and verified before use.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { download } = require('./model-download');
const { catalog, catalogAsset } = require('./model-catalog');
const { installManagedModel } = require('./managed-models');

const MODEL = catalog.defaultModel;
const ASSETS = {
  windows: { url: 'https://download.visualstudio.microsoft.com/download/pr/bd1c8d9d-ba95-4eee-bc6e-df1fcc876373/CC0FF0EB1DC3F5188AE6300FAEF32BF5BEEBA4BDD6E8E445A9184072096B713B/VC_redist.x64.exe', size: 25635768, sha: 'cc0ff0eb1dc3f5188ae6300faef32bf5beeba4bdd6e8e445a9184072096b713b' },
  engine: { url: 'https://github.com/ggml-org/llama.cpp/releases/download/b10549/llama-b10549-bin-win-cpu-x64.zip', size: 18581129, sha: '11d38f2ed878489b2c3d02b3d1a67683c02fbfb3d265876b9ede749a8dff5f1c' },
  model: catalogAsset(MODEL)
};

async function registryAsset(model, signal) {
  const name = model.replace(/^multimind:/, '');
  if (!/^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/i.test(name)) throw new Error('Invalid model name');
  const [repository, tag] = name.split(':');
  const base = `https://registry.ollama.ai/v2/library/${repository}`;
  const response = await fetch(`${base}/manifests/${tag}`, { signal });
  if (!response.ok) throw new Error(`Model manifest: HTTP ${response.status}`);
  const manifest = await response.json();
  const layers = manifest.layers || [];
  const models = layers.filter(layer => layer.mediaType === 'application/vnd.ollama.image.model');
  if (models.length !== 1 || layers.some(layer => /projector|adapter/.test(layer.mediaType))) throw new Error('This model requires additional components. Choose its Ollama version.');
  const layer = models[0];
  if (!/^sha256:[a-f0-9]{64}$/.test(layer.digest) || !Number.isSafeInteger(layer.size) || layer.size <= 0) throw new Error('Invalid model manifest');
  return { url: `${base}/blobs/${layer.digest}`, sha: layer.digest.slice(7), size: layer.size, manifest };
}

function createLocalRuntime(dataDir, options = {}) {
  const port = options.port || 11435;
  const host = `http://127.0.0.1:${port}`;
  const root = path.join(dataDir, 'runtime', 'llama-b10549');
  const defaultModelPath = path.join(root, 'qwen2.5-1.5b-q4_k_m.gguf');
  const indexFile = path.join(root, 'models.json');
  let activeModel = MODEL;
  function models() {
    let index = {};
    try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch {}
    const entries = Object.entries(index).filter(([name, item]) => name !== MODEL && name.startsWith('multimind:') && /^[a-f0-9]{64}\.gguf$/.test(item.file) && fs.existsSync(path.join(root, item.file))).map(([name, item]) => ({ name, displayName: item.displayName, size: item.size, file: path.join(root, item.file), backend: 'embedded', details: { verified: item.verified } }));
    if (fs.existsSync(defaultModelPath)) entries.unshift({ name: MODEL, size: ASSETS.model.size, file: defaultModelPath, backend: 'embedded', details: {} });
    return entries;
  }
  const marker = path.join(root, 'engine-verified');
  let child = null, setupPromise = null, startPromise = null, controller = null;
  let state = { stage: 'idle', completed: 0, total: 0, error: null };
  const supported = process.platform === 'win32' && process.arch === 'x64';
  const slots = () => os.freemem() >= 6 * 1024 ** 3 && os.cpus().length >= 4 ? 2 : 1;
  let activeSlots = 1;
  function windowsLibrariesPresent() {
    const system = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
    return ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll'].every(name => fs.existsSync(path.join(system, name)));
  }
  async function prepareWindowsLibraries(signal, report) {
    if (windowsLibrariesPresent()) return;
    report({ stage: 'windows', completed: 0, total: ASSETS.windows.size });
    const installer = path.join(root, 'vc_redist.x64.exe');
    await download(ASSETS.windows, installer, signal, (completed, total) => report({ completed, total }));
    signal.throwIfAborted();
    report({ stage: 'windows-install', completed: 0, total: 0 });
    await new Promise((resolve, reject) => {
      const script = "$ErrorActionPreference='Stop'; $signature=Get-AuthenticodeSignature -LiteralPath $env:MULTIMIND_VC_INSTALLER; if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { throw 'Invalid Microsoft signature' }; $installerProcess=Start-Process -FilePath $env:MULTIMIND_VC_INSTALLER -ArgumentList '/install','/passive','/norestart' -Verb RunAs -WindowStyle Hidden -Wait -PassThru; if ($installerProcess.ExitCode -notin @(0,3010,1638)) { throw ('Windows component installation failed: '+$installerProcess.ExitCode) }";
      const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, env: { ...process.env, MULTIMIND_VC_INSTALLER: installer } });
      let error = '';
      proc.stderr.on('data', chunk => { error = (error + chunk).slice(-1200); });
      proc.on('error', reject);
      proc.on('exit', code => code === 0 ? resolve() : reject(new Error(error || 'Windows components could not be installed')));
    });
    signal.throwIfAborted();
    if (!windowsLibrariesPresent()) throw new Error('Windows components require a restart. Restart Windows, then retry Quick setup.');
    fs.unlinkSync(installer);
  }
  function findServer(dir = root) {
    if (!fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const location = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === 'llama-server.exe') return location;
      if (entry.isDirectory()) { const found = findServer(location); if (found) return found; }
    }
    return null;
  }
  const installed = () => fs.existsSync(marker) && !!findServer() && models().length > 0;
  async function healthy() {
    if (!child) return false;
    try { return (await fetch(`${host}/health`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
  }
  async function start(requestedModel = activeModel) {
    if (startPromise) await startPromise;
    startPromise = (async () => {
      if (requestedModel === activeModel && await healthy()) return true;
      if (!installed()) return false;
      const selected = models().find(model => model.name === requestedModel) || (requestedModel === MODEL ? models()[0] : null);
      if (!selected) throw new Error('The selected local model is not downloaded');
      if (child) {
        const previous = child; child = null;
        await new Promise(resolve => { previous.once('exit', resolve); previous.kill(); });
      }
      activeModel = selected.name;
      activeSlots = slots();
      const exe = findServer();
      let lastError = '';
      const proc = spawn(exe, ['--model', selected.file, '--alias', activeModel, '--host', '127.0.0.1', '--port', String(port), '--ctx-size', String(8192 * activeSlots), '--parallel', String(activeSlots), '--threads', String(Math.max(1, Math.min(8, os.cpus().length - 1))), '--n-gpu-layers', '0'], { cwd: path.dirname(exe), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      child = proc;
      proc.stderr.on('data', chunk => { lastError = (lastError + chunk).slice(-1500); });
      proc.on('error', error => { lastError = error.message; if (child === proc) child = null; });
      proc.on('exit', () => { if (child === proc) child = null; });
      for (let i = 0; i < 120; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!child) throw new Error(lastError || 'Local engine exited');
        if (await healthy()) return true;
      }
      proc.kill();
      throw new Error('Local engine did not become ready in time. ' + lastError);
    })().finally(() => { startPromise = null; });
    return startPromise;
  }
  async function setup(onProgress, requestedModel = MODEL) {
    if (setupPromise) return { ok: false, error: 'Another model is downloading. Wait for it to finish.' };
    controller = new AbortController();
    const signal = controller.signal;
    const report = patch => { state = { ...state, ...patch }; onProgress(state); };
    setupPromise = (async () => {
      try {
        if (!supported) throw new Error('Quick setup currently supports Windows x64. Use Ollama on this platform.');
        report({ stage: 'manifest', completed: 0, total: 0, error: null });
        const asset = catalogAsset(requestedModel);
        requestedModel = asset.id;
        fs.mkdirSync(root, { recursive: true });
        await prepareWindowsLibraries(signal, report);
        report({ stage: 'engine', error: null, completed: 0, total: ASSETS.engine.size });
        if (!fs.existsSync(marker) || !findServer()) {
          const zip = path.join(root, 'engine.zip');
          await download(ASSETS.engine, zip, signal, (completed, total) => report({ completed, total }));
          report({ stage: 'extracting' });
          await new Promise((resolve, reject) => {
            // Paths are passed through environment variables, never shell interpolation.
            const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:MULTIMIND_ARCHIVE -DestinationPath $env:MULTIMIND_RUNTIME -Force'], { windowsHide: true, env: { ...process.env, MULTIMIND_ARCHIVE: zip, MULTIMIND_RUNTIME: root }, signal });
            proc.on('error', reject);
            proc.on('exit', code => code === 0 ? resolve() : reject(new Error('Could not unpack local engine')));
          });
          if (!findServer()) throw new Error('Downloaded runtime has no server');
          fs.writeFileSync(marker, ASSETS.engine.sha);
          fs.unlinkSync(zip);
        }
        report({ stage: 'model', model: requestedModel, completed: 0, total: asset.size || 0 });
        await installManagedModel(root, asset, signal, (completed, total) => report({ completed, total }), requestedModel === MODEL ? defaultModelPath : undefined);
        signal.throwIfAborted();
        report({ stage: 'starting', completed: 0, total: 0 });
        if (!child || requestedModel === MODEL) await start(requestedModel);
        signal.throwIfAborted();
        report({ stage: 'ready' });
        return { ok: true, model: requestedModel };
      } catch (error) {
        report({ stage: signal.aborted ? 'cancelled' : 'error', error: error.message });
        return { ok: false, error: error.message };
      } finally { controller = null; }
    })().finally(() => { setupPromise = null; });
    return setupPromise;
  }
  return {
    start, setup, installed,
    cancel() { controller?.abort(); },
    stop() { controller?.abort(); child?.kill(); child = null; },
    async status() { return { ...state, supported, installed: installed(), running: await healthy(), host, slots: activeSlots, model: activeModel, catalog: catalog.models, models: models().map(({ file, ...model }) => model), downloadBytes: ASSETS.engine.size + ASSETS.model.size + (supported && !windowsLibrariesPresent() ? ASSETS.windows.size : 0) }; }
  };
}
module.exports = { createLocalRuntime, download, ASSETS, MODEL, registryAsset };
