const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts');
const testCloud=require('../electron/ollama-cloud').createCloud(path.join(out,'ui-cloud'),require('electron').safeStorage,async()=>Response.json({models:[{name:'gpt-oss:120b'},{name:'test-cloud'}]}));
ipcMain.handle('test:cloud-status',()=>testCloud.status());
ipcMain.handle('test:cloud-save',(_e,key)=>testCloud.save(key));
ipcMain.handle('test:cloud-models',()=>testCloud.models());
ipcMain.handle('test:cloud-disconnect',()=>testCloud.disconnect());
const pluginHost=require(process.argv.includes('--packaged') ? path.join(root,'dist/win-unpacked/resources/app.asar/electron/mcp-plugins.js') : '../electron/mcp-plugins').createPlugins(path.join(out,'ui-plugins'),path.join(out,'ui-projects'));
ipcMain.handle('test:plugins-list',()=>pluginHost.list());
ipcMain.handle('test:plugins-add',(_e,config)=>pluginHost.add(config));
ipcMain.handle('test:plugins-toggle',(_e,id,enabled)=>pluginHost.toggle(id,enabled));
ipcMain.handle('test:plugins-remove',(_e,id)=>pluginHost.remove(id));
app.setPath('userData', path.join(out, 'ui-test-profile'));
app.commandLine.appendSwitch('force-prefers-reduced-motion', 'reduce');
const { createLocalRuntime, MODEL } = require('../electron/local-runtime');
const runtime = createLocalRuntime(path.join(out, 'runtime-test'), process.argv.includes('--catalog') ? { port: 11439 } : {});
app.on('window-all-closed', () => {});
let started = false;
ipcMain.handle('test:status', async () => process.argv.includes('--polish') ? ({ running:false, installed:true, supported:true, stage:'idle', models:[{name:'multimind:qwen2.5-1.5b',size:1117320736},{name:'multimind:deepseek-coder:6.7b',size:3800000000}] }) : started ? runtime.status() : ({ running: false, supported: true, stage: 'idle' }));
ipcMain.handle('test:setup', async () => { await runtime.start(); started = true; return { ok: true, model: MODEL }; });
ipcMain.handle('test:pull', async (event, model) => { const result = await runtime.setup(() => {}, model); started = true; setTimeout(() => { if (!event.sender.isDestroyed()) event.sender.send('test:pull-progress', { model, percent: 0 }); }, 100); return result; });
async function waitFor(win, expression, timeout = 90000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  fs.writeFileSync(path.join(out, 'ui-timeout.json'), JSON.stringify(await win.webContents.executeJavaScript(`({rows:document.querySelector('#teamRows').textContent, status: document.querySelector('#localSetupStatus').textContent})`), null, 2));
  throw new Error('Timed out: ' + expression);
}
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  // Rasterize the repo-native SVG for Windows packaging.
  const icon = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } });
  const svg = fs.readFileSync(path.join(root, 'resources/multimind-logo.svg'), 'utf8');
  await icon.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<style>html,body{margin:0;width:256px;height:256px;overflow:hidden}svg{display:block;width:256px;height:256px}</style>${svg}`));
  await new Promise(resolve => setTimeout(resolve, 300));
  const png = (await icon.webContents.capturePage()).toPNG();
  fs.writeFileSync(path.join(root, 'resources/multimind-logo.png'), png);
  const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(root, 'resources/multimind-logo.ico'), Buffer.concat([header, png]));
  icon.destroy();
  const win = new BrowserWindow({ width: 1200, height: 780, frame: false, show: false, webPreferences: { preload: path.join(__dirname, 'ui-preload.cjs'), offscreen: true } });
  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => { if (level === 3 && !/ERR_|Content Security|Failed to load resource/.test(message)) errors.push(message); });
  await win.loadFile(path.join(root, process.argv.includes('--packaged') ? 'dist/win-unpacked/resources/app.asar/index.html' : 'index.html'));
  await waitFor(win, `document.querySelector('#localSetupBtn').textContent === ${JSON.stringify(process.env.MULTIMIND_PREVIEW_LANGUAGE === 'en' ? 'Quick setup' : 'Быстрая настройка')}`);
  await new Promise(resolve => setTimeout(resolve, 1800));
  fs.writeFileSync(path.join(out, 'multimind-welcome.png'), (await win.webContents.capturePage()).toPNG());
  assert.ok(await win.webContents.executeJavaScript(`document.querySelector('#localSetupCard').getBoundingClientRect().bottom < document.querySelector('.composer').getBoundingClientRect().top`), 'Setup must not overlap composer');
  console.log('Welcome screenshot saved');
  if (process.argv.includes('--cloud')) {
    await win.webContents.executeJavaScript("document.querySelector('#settingsBtn').click();document.querySelector('[data-settings-tab=cloud]').click();document.querySelector('#cloudApiKey').value='fixture-cloud-key';document.querySelector('#cloudAccountForm').requestSubmit()");
    await waitFor(win,"document.querySelector('#cloudDisconnect').hidden === false && document.querySelectorAll('.cloud-model-row').length===2");
    assert.ok(!fs.readFileSync(path.join(out,'ui-cloud','ollama-cloud.key'),'utf8').includes('fixture-cloud-key'));
    await win.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('ollama-cloud-problem',{detail:{kind:'rate',message:'Too many requests'}}))");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('#cloudPlansModal').classList.contains('show')"),false);
    await win.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('ollama-cloud-problem',{detail:{kind:'billing',message:'Insufficient credits'}}))");
    await new Promise(resolve=>setTimeout(resolve,300));
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('#cloudPlansModal').classList.contains('show')"),true);
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('#cloudPlansClose').getBoundingClientRect().width"),44);
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('#cloudPlansClose svg').getBoundingClientRect().width"),24);
    fs.writeFileSync(path.join(out,'multimind-cloud-plans.png'),(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript("document.querySelector('#cloudPlansClose').click();document.querySelector('.cloud-model-row').click()");
    assert.match(await win.webContents.executeJavaScript("document.querySelector('#modelLabel').textContent"),/cloud:gpt-oss/);
    assert.deepEqual(errors,[]);testCloud.disconnect();console.log('PASS: encrypted Windows credentials, cloud selection, billing dialog, rate limits do not open pricing');win.destroy();app.quit();return;
  }
  if (process.argv.includes('--plugins')) {
    for(const entry of pluginHost.list())await pluginHost.remove(entry.id);
    fs.mkdirSync(path.join(out,'ui-projects'),{recursive:true});
    await win.webContents.executeJavaScript("document.querySelector('#settingsBtn').click();document.querySelector('[data-settings-tab=plugins]').click();document.querySelector('#pluginForm').requestSubmit()");
    await waitFor(win,"!!document.querySelector('#pluginsList .activity-switch')");
    await win.webContents.executeJavaScript("document.querySelector('#pluginsList .activity-switch').click()");
    await waitFor(win,"document.querySelector('#pluginsList').textContent.includes('connected') && document.querySelector('#pluginsList').textContent.includes('list_projects')");
    await win.webContents.executeJavaScript("document.querySelector('#pluginsList details').open=true");
    fs.writeFileSync(path.join(out,'multimind-plugins.png'),(await win.webContents.capturePage()).toPNG());
    assert.deepEqual(errors,[]);
    await pluginHost.close();console.log('PASS: Plugins UI adds, enables and discovers real stdio tools under Electron');win.destroy();app.quit();return;
  }
  if (process.argv.includes('--polish')) {
    const radius = await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.composer-field')).borderTopLeftRadius");
    await win.webContents.executeJavaScript("document.querySelector('#userInput').focus()");
    assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.composer-field')).borderTopLeftRadius"), radius);
    await win.webContents.executeJavaScript("document.querySelector('.app').classList.add('tab-collapsed')");
    assert.ok(await win.webContents.executeJavaScript("(()=>{const a=document.querySelector('.side-logo').getBoundingClientRect(),b=document.querySelector('.multimind-mark-img').getBoundingClientRect();return Math.abs((a.left+a.right-b.left-b.right)/2)<1 && Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<1})()"));
    await win.webContents.executeJavaScript("document.querySelector('.app').classList.remove('tab-collapsed'); document.querySelector('#settingsBtn').click();document.querySelector('[data-settings-tab=models]').click();document.querySelector('.worker-picker-trigger').click()");
    assert.ok(await win.webContents.executeJavaScript("(()=>{const a=document.querySelector('.worker-picker-trigger').getBoundingClientRect(),b=document.querySelector('.worker-picker-list').getBoundingClientRect();return Math.abs(a.width-b.width)<1&&Math.abs(a.left-b.left)<1&&Math.abs(a.bottom-b.top)<1})()"));
    await new Promise(resolve=>setTimeout(resolve,300));
    fs.writeFileSync(path.join(out,'multimind-worker-picker.png'),(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript("document.querySelector('.worker-picker-list [data-value=\"multimind:deepseek-coder:6.7b\"]').click()");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('#workerModel0').value"),'multimind:deepseek-coder:6.7b');
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('.worker-picker-trigger').getAttribute('aria-expanded')"),'false');
    assert.deepEqual(errors,[]);
    console.log('PASS: composer radius stable on focus, centered collapsed icon, aligned dropdown and model selection');
    win.destroy(); app.quit(); return;
  }
  if (process.argv.includes('--settings')) {
    await win.webContents.executeJavaScript("document.querySelector('#settingsBtn').click()");
    assert.ok(await win.webContents.executeJavaScript("document.querySelector('.settings-modal').getBoundingClientRect().width === innerWidth"));
    await win.webContents.executeJavaScript("document.querySelector('#languageToggle').click()");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('#languageToggle').getAttribute('aria-expanded')"), 'true');
    await new Promise(resolve => setTimeout(resolve, 400));
    fs.writeFileSync(path.join(out, 'multimind-settings.png'), (await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript("document.querySelector('[data-lang=en]').click()");
    assert.equal(await win.webContents.executeJavaScript("document.documentElement.lang"), 'en');
    await win.webContents.executeJavaScript("document.querySelector('[data-settings-tab=models]').click()");
    assert.ok(await win.webContents.executeJavaScript("!document.querySelector('.agent-settings').hidden && document.querySelector('.settings-language').hidden"));
    assert.deepEqual(errors, []);
    await win.webContents.executeJavaScript("document.querySelector('[data-settings-tab=discord]').click()");
    win.setSize(1920,1080);
    await new Promise(resolve=>setTimeout(resolve,400));
    assert.ok(await win.webContents.executeJavaScript("!document.querySelector('.discord-settings').hidden && document.querySelector('.discord-settings').getBoundingClientRect().right < innerWidth"));
    fs.writeFileSync(path.join(out, 'multimind-discord-settings.png'), (await win.webContents.capturePage()).toPNG());
    const sharp = require(process.argv.includes('--packaged') ? path.join(root,'dist/win-unpacked/resources/app.asar/node_modules/sharp') : 'sharp');
    assert.equal((await sharp(path.join(root,'resources/multimind-logo-animated.gif'),{animated:true}).metadata()).pages,64);
    console.log('PASS: full-window settings, language selection, section navigation, Discord panel at 1920px and native GIF decoder');
    win.destroy(); app.quit(); return;
  }
  if (process.argv.includes('--preview')) { win.destroy(); app.quit(); return; }
  if (process.argv.includes('--catalog')) {
    await win.webContents.executeJavaScript(`document.querySelector('#modelBtn').click(); document.querySelector('#ddOpenModels').click();`);
    await waitFor(win, `!!document.querySelector('[data-action="pull"][data-model="multimind:qwen2.5:0.5b"]')`);
    await win.webContents.executeJavaScript(`document.querySelector('[data-action="pull"][data-model="multimind:qwen2.5:0.5b"]').click()`);
    await waitFor(win, `document.querySelector('#modelLabel').textContent === 'multimind:qwen2.5:0.5b'`);
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(await win.webContents.executeJavaScript(`document.querySelector('[data-model="multimind:qwen2.5:0.5b"].catalog-item').querySelectorAll('.catalog-progress-wrap').length`), 0, 'A late progress event must not restore 0% after download');
    assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('#windowTitlebar')).webkitAppRegion`), 'drag');
    assert.ok((await runtime.status()).models.some(model => model.name === 'multimind:qwen2.5:0.5b'));
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'multimind-local-catalog.png'), (await win.webContents.capturePage()).toPNG());
    console.log('PASS: native catalog download button prepares and selects the model without an Ollama API');
    win.destroy(); runtime.stop(); app.quit(); return;
  }
  await win.webContents.executeJavaScript(`document.querySelector('#localSetupBtn').click()`);
  await waitFor(win, `document.querySelector('#localSetupCard').hidden`);
  await win.webContents.executeJavaScript(`const input = document.querySelector('#userInput'); input.value = 'Сравни JSON и XML. Раздели работу: один специалист рассматривает читаемость форматов, другой — представление вложенных данных. Дай общий вывод.'; input.dispatchEvent(new Event('input')); document.querySelector('#sendBtn').click();`);
  await waitFor(win, `document.querySelectorAll('[data-agent-id^="worker-"]').length === 2`);
  await waitFor(win, `document.querySelector('#teamRows pre')?.textContent.length > 20`);
  assert.ok(await win.webContents.executeJavaScript(`!!document.querySelector('.thinking-message #teamPanel')`), 'Agents must be inside the reply');
  fs.writeFileSync(path.join(out, 'multimind-agents-working.png'), (await win.webContents.capturePage()).toPNG());
  await waitFor(win, `!!document.querySelector('.agent-history')`, 90000);
  const result = await win.webContents.executeJavaScript(`({title: document.title, rows: [...document.querySelectorAll('.team-row')].map(el => ({status: el.className, text: el.innerText})), text: document.querySelector('#messages').innerText})`);
  fs.writeFileSync(path.join(out, 'ui-smoke-result.json'), JSON.stringify({ errors, ...result }, null, 2));
  assert.equal(result.title, 'MultiMind');
  assert.ok(result.rows.length >= 2, 'Expected two real specialists');
  assert.ok(result.rows.every(row => row.status.includes('done')));
  await waitFor(win, `document.querySelectorAll('.blur-text-word:not(.blur-text-done)').length === 0`);
  await win.webContents.executeJavaScript(`document.querySelector('#chatContainer').scrollTop = 0`);
  fs.writeFileSync(path.join(out, 'multimind-agents-result.png'), (await win.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(out, 'ui-smoke-result.json'), JSON.stringify({ errors, ...result }, null, 2));
  assert.deepEqual(errors, []);
  await win.webContents.executeJavaScript(`const next = document.querySelector('#userInput'); next.value = 'Раздели работу между специалистами: сравни Python и JavaScript для обучения и для серверной разработки.'; next.dispatchEvent(new Event('input')); document.querySelector('#sendBtn').click();`);
  await waitFor(win, `document.querySelectorAll('.team-row.working').length > 0`);
  await win.webContents.executeJavaScript(`document.querySelector('#stopBtn').click()`);
  await waitFor(win, `document.querySelectorAll('.team-row.working,.team-row.queued').length === 0`);
  assert.ok(await win.webContents.executeJavaScript(`document.querySelectorAll('.team-row.stopped').length > 0`));
  console.log('PASS: welcome, automatic runtime start, coordinator, two real workers, final answer; no renderer errors');
  win.destroy(); runtime.stop(); app.quit();
}).catch(error => { console.error(error); runtime.stop(); app.exit(1); });
