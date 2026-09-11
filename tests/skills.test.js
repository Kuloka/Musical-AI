const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSkillsStore } = require('../electron/app-skills');
test('skills import separately, enable explicitly and retain enabled state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'multimind-skills-'));
  try {
    const source = path.join(root, 'Concise.md');
    fs.writeFileSync(source, 'Keep answers concise.');
    const store = createSkillsStore(path.join(root, 'data'));
    assert.equal(store.presets().length, 3);
    const presetResult = store.installPreset('code-review');
    assert.equal(presetResult.presets.find(item => item.id === 'code-review').installed, true);
    assert.equal(presetResult.entries.find(item => item.name === 'Code Review.md').enabled, true);
    assert.equal(store.importFile(source).find(item => item.name === 'Concise.md').enabled, false);
    store.toggle('Concise.md', true);
    assert.equal(createSkillsStore(path.join(root, 'data')).list()[0].enabled, true);
    assert.equal(store.importFile(source).length, 3);
    assert.throws(() => store.toggle('../Concise.md', true), /not found/);
    store.toggle('Concise.md', false);
    assert.equal(store.list().find(skill => skill.name === 'Concise.md').enabled, false);
    assert.equal(store.list().find(skill => skill.name === 'Code Review.md').enabled, true);
    fs.writeFileSync(source, 'x'.repeat(12001));
    assert.throws(() => store.importFile(source), /12,000/);
  } finally {
    const target = path.resolve(root);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('multimind-skills-'));
    fs.rmSync(target, { recursive: true });
  }
});
