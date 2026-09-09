const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeStorage } = require('../electron/storage-migration');
const { shouldShowSetup } = require('../musical-ai');

test('setup stays hidden for downloaded models before the engine starts', () => {
  assert.equal(shouldShowSetup({ installed: true, running: false, stage: 'idle' }, 0, false), false);
  assert.equal(shouldShowSetup({ installed: false, stage: 'idle' }, 2, false), false);
  assert.equal(shouldShowSetup({ installed: false, stage: 'idle' }, 0, true), false);
  assert.equal(shouldShowSetup({ installed: false, stage: 'idle' }, 0, false), true);
  assert.equal(shouldShowSetup({ installed: true, stage: 'model' }, 0, true), true);
});

test('storage migration preserves chats, models and projects and runs only once', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'musical-migration-'));
  const write = (file, text) => { const location = path.join(home, file); fs.mkdirSync(path.dirname(location), { recursive: true }); fs.writeFileSync(location, text); };
  try {
    write('.nevo-data/data.json', '{"groups":[],"chats":[]}');
    write('.nevo-data/settings.json', '{"selectedModel":"musical:qwen2.5-1.5b"}');
    write('.nevo-data/runtime/model.gguf', 'model bytes');
    write('NevoProject/NevoProject2/main.py', 'print(42)');
    write('NevoProject/Custom/main.js', 'original');
    write('MusicalProject/Custom/main.js', 'newer');
    const dirs = initializeStorage(home);
    assert.equal(path.basename(dirs.projectsDir), 'MusicalProject');
    assert.equal(fs.readFileSync(path.join(dirs.dataDir, 'runtime/model.gguf'), 'utf8'), 'model bytes');
    assert.equal(fs.readFileSync(path.join(dirs.projectsDir, 'MusicalProject2/main.py'), 'utf8'), 'print(42)');
    assert.equal(fs.readFileSync(path.join(dirs.projectsDir, 'Custom/main.js'), 'utf8'), 'newer');
    assert.equal(fs.readFileSync(path.join(home, 'NevoProject/Custom/main.js'), 'utf8'), 'original');
    write('.nevo-data/runtime/later.gguf', 'old installation update');
    initializeStorage(home);
    assert.equal(fs.existsSync(path.join(dirs.dataDir, 'runtime/later.gguf')), false);
    assert.ok(fs.existsSync(path.join(dirs.dataDir, 'data.json')));
    assert.ok(fs.existsSync(path.join(dirs.dataDir, 'settings.json')));
  } finally {
    const resolved = path.resolve(home);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('musical-migration-'));
    fs.rmSync(resolved, { recursive: true });
  }
});
