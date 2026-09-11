const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeStorage } = require('../electron/storage-migration');
const { shouldShowSetup } = require('../multimind');

test('setup stays hidden for downloaded models before the engine starts', () => {
  assert.equal(shouldShowSetup({ installed: true, running: false, stage: 'idle' }, 0, false), false);
  assert.equal(shouldShowSetup({ installed: false, stage: 'idle' }, 2, false), false);
  assert.equal(shouldShowSetup({ installed: false, stage: 'idle' }, 0, true), false);
  assert.equal(shouldShowSetup({ installed: false, stage: 'idle' }, 0, false), true);
  assert.equal(shouldShowSetup({ installed: true, stage: 'model' }, 0, true), true);
});

test('storage migration preserves chats, models and projects and runs only once', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'multimind-migration-'));
  const write = (file, text) => { const location = path.join(home, file); fs.mkdirSync(path.dirname(location), { recursive: true }); fs.writeFileSync(location, text); };
  try {
    write('.nevo-data/data.json', '{"groups":[],"chats":[]}');
    write('.nevo-data/settings.json', '{"selectedModel":"multimind:qwen2.5-1.5b"}');
    write('.nevo-data/runtime/model.gguf', 'model bytes');
    write('NevoProject/NevoProject2/main.py', 'print(42)');
    write('NevoProject/Custom/main.js', 'original');
    write('MultiMindProject/Custom/main.js', 'newer');
    const dirs = initializeStorage(home);
    assert.equal(path.basename(dirs.projectsDir), 'MultiMindProject');
    assert.equal(fs.readFileSync(path.join(dirs.dataDir, 'runtime/model.gguf'), 'utf8'), 'model bytes');
    assert.equal(fs.readFileSync(path.join(dirs.projectsDir, 'MultiMindProject2/main.py'), 'utf8'), 'print(42)');
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
    assert.ok(path.basename(resolved).startsWith('multimind-migration-'));
    fs.rmSync(resolved, { recursive: true });
  }
});

test('MultiMind imports Musical data and model references without rewriting messages or overwriting current settings',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'multimind-upgrade-'));
 const write=(name,value)=>{const file=path.join(home,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
 try {
  const hash='a'.repeat(64);
  write('.musical-data/.storage-migrated-v1','old marker');
  write('.musical-data/settings.json',JSON.stringify({selectedModel:'musical:qwen2.5-1.5b',workerModels:['musical:tiny:1b','cloud:test'],appLanguage:'tr'}));
  write('.musical-data/runtime/llama-b10549/models.json',JSON.stringify({'musical:tiny:1b':{file:hash+'.gguf',size:4}}));
  write('.musical-data/runtime/llama-b10549/'+hash+'.gguf','GGUF');
  write('.musical-data/data.json',JSON.stringify({groups:[{name:'MusicalProject2',folderName:'MusicalProject2',path:path.join(home,'MusicalProject','MusicalProject2')}],chats:[{model:'musical:tiny:1b',messages:[{content:'My Musical AI project'}]}]}));
  write('MusicalProject/MusicalProject2/main.js','original project');
  const dirs=initializeStorage(home),settings=JSON.parse(fs.readFileSync(path.join(dirs.dataDir,'settings.json'))),data=JSON.parse(fs.readFileSync(path.join(dirs.dataDir,'data.json')));
  assert.equal(settings.selectedModel,'multimind:qwen2.5-1.5b');assert.equal(settings.appLanguage,'tr');assert.deepEqual(settings.workerModels,['multimind:tiny:1b','cloud:test']);
  assert.ok(JSON.parse(fs.readFileSync(path.join(dirs.dataDir,'runtime/llama-b10549/models.json')))['multimind:tiny:1b']);
  assert.equal(data.groups[0].folderName,'MultiMindProject2');assert.equal(data.groups[0].path,path.join(dirs.projectsDir,'MultiMindProject2'));
  assert.equal(data.chats[0].model,'multimind:tiny:1b');assert.equal(data.chats[0].messages[0].content,'My Musical AI project');
  assert.equal(fs.readFileSync(path.join(dirs.projectsDir,'MultiMindProject2/main.js'),'utf8'),'original project');
  assert.ok(fs.existsSync(path.join(home,'.musical-data/runtime/llama-b10549/'+hash+'.gguf')));
  write('.multimind-data/settings.json','{"appLanguage":"de"}');initializeStorage(home);assert.equal(JSON.parse(fs.readFileSync(path.join(dirs.dataDir,'settings.json'))).appLanguage,'de');
 }finally{assert.equal(path.dirname(path.resolve(home)),path.resolve(os.tmpdir()));assert.ok(path.basename(home).startsWith('multimind-upgrade-'));fs.rmSync(home,{recursive:true});}
});
