const fs = require('fs');
const path = require('path');

// Import once without deleting the old installation's data or overwriting new files.
function initializeStorage(home) {
  const dataDir = path.join(home, '.multimind-data');
  const projectsDir = path.join(home, 'MultiMindProject');
  const marker = path.join(dataDir, '.storage-migrated-v2');
  const imported = new Set();
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
      imported.add(target);
    }
  }
  for (const oldName of ['.musical-data', '.nevo-data', '.nebula-data']) {
    const source = path.join(home, oldName);
    if (!fs.existsSync(source)) continue;
    for (const name of fs.readdirSync(source)) {
      if (['cache', 'gpu-cache', 'electron-user-data'].includes(name) || name.startsWith('.storage-migrated')) continue;
      copyMissing(path.join(source, name), path.join(dataDir, name));
    }
  }
  const renameProject = name => name.replace(/^(Musical|Nevo|Nebula)Project/i, 'MultiMindProject');
  for (const oldName of ['MusicalProject', 'NevoProject', 'NebulaProject']) {
    const source = path.join(home, oldName);
    if (!fs.existsSync(source)) continue;
    for (const name of fs.readdirSync(source)) {
      const renamed = renameProject(name);
      copyMissing(path.join(source, name), path.join(projectsDir, renamed));
    }
  }
  // Rewrite machine-owned references, never the user's messages or file contents.
  const renameModel = value => typeof value === 'string' ? value.replace(/^musical:/, 'multimind:') : value;
  for (const file of imported) {
    if (!file.startsWith(dataDir + path.sep) || !file.endsWith('.json')) continue;
    const relative = path.relative(dataDir, file).split(path.sep).join('/');
    if (!['settings.json','data.json','runtime/llama-b10549/models.json'].includes(relative)) continue;
    try {
      let value=JSON.parse(fs.readFileSync(file,'utf8'));
      if (relative.endsWith('/models.json')) value=Object.fromEntries(Object.entries(value).map(([name,item])=>[renameModel(name),item]));
      if (relative==='settings.json') {
        value.selectedModel=renameModel(value.selectedModel);
        if(Array.isArray(value.workerModels)) value.workerModels=value.workerModels.map(renameModel);
      }
      if (relative==='data.json') {
        for(const group of value.groups||[]) {
          for(const key of ['name','folderName'])if(typeof group[key]==='string')group[key]=renameProject(group[key]);
          if(typeof group.path==='string')for(const old of ['MusicalProject','NevoProject','NebulaProject']) {
            const prefix=path.join(home,old)+path.sep;
            if(group.path.startsWith(prefix))group.path=path.join(projectsDir,renameProject(group.path.slice(prefix.length)));
          }
        }
        for(const chat of value.chats||[])if(typeof chat.model==='string')chat.model=renameModel(chat.model);
      }
      fs.writeFileSync(file,JSON.stringify(value,null,2));
    } catch (error) {
      // Keep malformed imported JSON intact for recovery; original folders remain available.
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  fs.writeFileSync(marker, 'Imported legacy data; original folders retained as backups.\n');
  return { dataDir, projectsDir };
}
module.exports = { initializeStorage };
