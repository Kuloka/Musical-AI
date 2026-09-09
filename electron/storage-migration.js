const fs = require('fs');
const path = require('path');

// Import once without deleting the old installation's data or overwriting new files.
function initializeStorage(home) {
  const dataDir = path.join(home, '.musical-data');
  const projectsDir = path.join(home, 'MusicalProject');
  const marker = path.join(dataDir, '.storage-migrated-v1');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(projectsDir, { recursive: true });
  if (fs.existsSync(marker)) return { dataDir, projectsDir };
  function copyMissing(source, target) {
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      if (fs.existsSync(target) && !fs.statSync(target).isDirectory()) return;
      fs.mkdirSync(target, { recursive: true });
      for (const name of fs.readdirSync(source)) copyMissing(path.join(source, name), path.join(target, name));
    } else if (stat.isFile() && !fs.existsSync(target)) {
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    }
  }
  for (const oldName of ['.nevo-data', '.nebula-data']) {
    const source = path.join(home, oldName);
    if (!fs.existsSync(source)) continue;
    for (const name of fs.readdirSync(source)) {
      if (['cache', 'gpu-cache', 'electron-user-data'].includes(name)) continue;
      copyMissing(path.join(source, name), path.join(dataDir, name));
    }
  }
  for (const oldName of ['NevoProject', 'NebulaProject']) {
    const source = path.join(home, oldName);
    if (!fs.existsSync(source)) continue;
    for (const name of fs.readdirSync(source)) {
      const renamed = name.replace(/^(Nevo|Nebula)Project/i, 'MusicalProject');
      copyMissing(path.join(source, name), path.join(projectsDir, renamed));
    }
  }
  fs.writeFileSync(marker, 'Imported legacy data; original folders retained as backups.\n');
  return { dataDir, projectsDir };
}
module.exports = { initializeStorage };
