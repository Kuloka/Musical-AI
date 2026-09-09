const fs = require('fs');
const path = require('path');

function createSkillsStore(dataDir) {
  const directory = path.join(dataDir, 'skills');
  const stateFile = path.join(dataDir, 'skills-enabled.json');
  fs.mkdirSync(directory, { recursive: true });
  function enabled() { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return []; } }
  function list() {
    const selected = new Set(enabled());
    return fs.readdirSync(directory).filter(name => name.endsWith('.md')).filter(name => fs.lstatSync(path.join(directory, name)).isFile()).map(name => ({ name, enabled: selected.has(name), content: fs.readFileSync(path.join(directory, name), 'utf8') }));
  }
  function toggle(name, active) {
    const entries = list();
    if (!entries.some(entry => entry.name === name)) throw new Error('Skill not found');
    const selected = new Set(enabled());
    active ? selected.add(name) : selected.delete(name);
    if (entries.filter(entry => selected.has(entry.name)).reduce((sum, entry) => sum + entry.content.length, 0) > 24000) throw new Error('Enabled skills exceed 24,000 characters. Disable another skill first.');
    fs.writeFileSync(stateFile, JSON.stringify([...selected]));
    return list();
  }
  function importFile(source) {
    if (path.extname(source).toLowerCase() !== '.md' || fs.statSync(source).size > 48000) throw new Error('Choose a Markdown skill up to 48 KB');
    const content = fs.readFileSync(source, 'utf8');
    if (!content.trim() || content.length > 12000) throw new Error('A skill must contain 1–12,000 characters');
    const stem = path.basename(source, path.extname(source)).replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80) || 'Skill';
    let name = stem + '.md', i = 2;
    while (fs.existsSync(path.join(directory, name))) name = `${stem} ${i++}.md`;
    fs.writeFileSync(path.join(directory, name), content, { flag: 'wx' });
    return list();
  }
  return { directory, list, toggle, importFile };
}
module.exports = { createSkillsStore };
