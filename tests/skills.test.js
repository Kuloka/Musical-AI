const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSkillsStore } = require('../electron/app-skills');
test('skills import separately, enable explicitly and retain enabled state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'musical-skills-'));
  try {
    const source = path.join(root, 'Concise.md');
    fs.writeFileSync(source, 'Keep answers concise.');
    const store = createSkillsStore(path.join(root, 'data'));
    assert.equal(store.importFile(source)[0].enabled, false);
    store.toggle('Concise.md', true);
    assert.equal(createSkillsStore(path.join(root, 'data')).list()[0].enabled, true);
    assert.equal(store.importFile(source).length, 2);
    assert.throws(() => store.toggle('../Concise.md', true), /not found/);
    store.toggle('Concise.md', false);
    assert.ok(store.list().every(skill => !skill.enabled));
    fs.writeFileSync(source, 'x'.repeat(12001));
    assert.throws(() => store.importFile(source), /12,000/);
  } finally {
    const target = path.resolve(root);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('musical-skills-'));
    fs.rmSync(target, { recursive: true });
  }
});
