const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts');
app.setPath('userData', path.join(out, 'ui-test-profile'));
app.commandLine.appendSwitch('force-prefers-reduced-motion', 'reduce');
const { createLocalRuntime, MODEL } = require('../electron/local-runtime');
const runtime = createLocalRuntime(path.join(out, 'runtime-test'), process.argv.includes('--catalog') ? { port: 11439 } : {});
app.on('window-all-closed', () => {});
let started = false;
ipcMain.handle('test:status', async () => process.argv.includes('--polish') ? ({ running:false, installed:true, supported:true, stage:'idle', models:[{name:'musical:qwen2.5-1.5b',size:1117320736},{name:'musical:deepseek-coder:6.7b',size:3800000000}] }) : started ? runtime.status() : ({ running: false, supported: true, stage: 'idle' }));
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
  const svg = fs.readFileSync(path.join(root, 'resources/musical-logo.svg'), 'utf8');
  await icon.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<style>html,body{margin:0;width:256px;height:256px;overflow:hidden}svg{display:block;width:256px;height:256px}</style>${svg}`));
  await new Promise(resolve => setTimeout(resolve, 300));
  const png = (await icon.webContents.capturePage()).toPNG();
  fs.writeFileSync(path.join(root, 'resources/musical-logo.png'), png);
  const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(root, 'resources/musical-logo.ico'), Buffer.concat([header, png]));
  icon.destroy();
  const win = new BrowserWindow({ width: 1200, height: 780, frame: false, show: false, webPreferences: { preload: path.join(__dirname, 'ui-preload.cjs'), offscreen: true } });
  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => { if (level === 3 && !/ERR_|Content Security|Failed to load resource/.test(message)) errors.push(message); });
  await win.loadFile(path.join(root, 'index.html'));
  await waitFor(win, `document.querySelector('#localSetupBtn').textContent === 'Быстрая настройка'`);
  await new Promise(resolve => setTimeout(resolve, 1800));
  fs.writeFileSync(path.join(out, 'musical-welcome.png'), (await win.webContents.capturePage()).toPNG());
  assert.ok(await win.webContents.executeJavaScript(`document.querySelector('#localSetupCard').getBoundingClientRect().bottom < document.querySelector('.composer').getBoundingClientRect().top`), 'Setup must not overlap composer');
  console.log('Welcome screenshot saved');
  if (process.argv.includes('--polish')) {
    const radius = await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.composer-field')).borderTopLeftRadius");
    await win.webContents.executeJavaScript("document.querySelector('#userInput').focus()");
    assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.composer-field')).borderTopLeftRadius"), radius);
    await win.webContents.executeJavaScript("document.querySelector('.app').classList.add('tab-collapsed')");
    assert.ok(await win.webContents.executeJavaScript("(()=>{const a=document.querySelector('.side-logo').getBoundingClientRect(),b=document.querySelector('.musical-mark-img').getBoundingClientRect();return Math.abs((a.left+a.right-b.left-b.right)/2)<1 && Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<1})()"));
    await win.webContents.executeJavaScript("document.querySelector('.app').classList.remove('tab-collapsed'); document.querySelector('#settingsBtn').click();document.querySelector('[data-settings-tab=models]').click();document.querySelector('.worker-picker-trigger').click()");
    assert.ok(await win.webContents.executeJavaScript("(()=>{const a=document.querySelector('.worker-picker-trigger').getBoundingClientRect(),b=document.querySelector('.worker-picker-list').getBoundingClientRect();return Math.abs(a.width-b.width)<1&&Math.abs(a.left-b.left)<1&&Math.abs(a.bottom-b.top)<1})()"));
    await new Promise(resolve=>setTimeout(resolve,300));
    fs.writeFileSync(path.join(out,'musical-worker-picker.png'),(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript("document.querySelector('.worker-picker-list [data-value=\"musical:deepseek-coder:6.7b\"]').click()");
    assert.equal(await win.webContents.executeJavaScript("document.querySelector('#workerModel0').value"),'musical:deepseek-coder:6.7b');
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
    fs.writeFileSync(path.join(out, 'musical-settings.png'), (await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript("document.querySelector('[data-lang=en]').click()");
    assert.equal(await win.webContents.executeJavaScript("document.documentElement.lang"), 'en');
    await win.webContents.executeJavaScript("document.querySelector('[data-settings-tab=models]').click()");
    assert.ok(await win.webContents.executeJavaScript("!document.querySelector('.agent-settings').hidden && document.querySelector('.settings-language').hidden"));
    assert.deepEqual(errors, []);
    await win.webContents.executeJavaScript("document.querySelector('[data-settings-tab=discord]').click()");
    win.setSize(1920,1080);
    await new Promise(resolve=>setTimeout(resolve,400));
    assert.ok(await win.webContents.executeJavaScript("!document.querySelector('.discord-settings').hidden && document.querySelector('.discord-settings').getBoundingClientRect().right < innerWidth"));
    fs.writeFileSync(path.join(out, 'musical-discord-settings.png'), (await win.webContents.capturePage()).toPNG());
    const sharp = require(process.argv.includes('--packaged') ? path.join(root,'dist/win-unpacked/resources/app.asar/node_modules/sharp') : 'sharp');
    assert.equal((await sharp(path.join(root,'resources/musical-logo-animated.gif'),{animated:true}).metadata()).pages,64);
    console.log('PASS: full-window settings, language selection, section navigation, Discord panel at 1920px and native GIF decoder');
    win.destroy(); app.quit(); return;
  }
  if (process.argv.includes('--preview')) { win.destroy(); app.quit(); return; }
  if (process.argv.includes('--catalog')) {
    await win.webContents.executeJavaScript(`document.querySelector('#modelBtn').click(); document.querySelector('#ddOpenModels').click();`);
    await waitFor(win, `!!document.querySelector('[data-action="pull"][data-model="musical:qwen2.5:0.5b"]')`);
    await win.webContents.executeJavaScript(`document.querySelector('[data-action="pull"][data-model="musical:qwen2.5:0.5b"]').click()`);
    await waitFor(win, `document.querySelector('#modelLabel').textContent === 'musical:qwen2.5:0.5b'`);
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(await win.webContents.executeJavaScript(`document.querySelector('[data-model="musical:qwen2.5:0.5b"].catalog-item').querySelectorAll('.catalog-progress-wrap').length`), 0, 'A late progress event must not restore 0% after download');
    assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('#windowTitlebar')).webkitAppRegion`), 'drag');
    assert.ok((await runtime.status()).models.some(model => model.name === 'musical:qwen2.5:0.5b'));
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'musical-local-catalog.png'), (await win.webContents.capturePage()).toPNG());
    console.log('PASS: native catalog download button prepares and selects the model without an Ollama API');
    win.destroy(); runtime.stop(); app.quit(); return;
  }
  await win.webContents.executeJavaScript(`document.querySelector('#localSetupBtn').click()`);
  await waitFor(win, `document.querySelector('#localSetupCard').hidden`);
  await win.webContents.executeJavaScript(`const input = document.querySelector('#userInput'); input.value = 'Сравни JSON и XML. Раздели работу: один специалист рассматривает читаемость форматов, другой — представление вложенных данных. Дай общий вывод.'; input.dispatchEvent(new Event('input')); document.querySelector('#sendBtn').click();`);
  await waitFor(win, `document.querySelectorAll('[data-agent-id^="worker-"]').length === 2`);
  await waitFor(win, `document.querySelector('#teamRows pre')?.textContent.length > 20`);
  assert.ok(await win.webContents.executeJavaScript(`!!document.querySelector('.thinking-message #teamPanel')`), 'Agents must be inside the reply');
  fs.writeFileSync(path.join(out, 'musical-agents-working.png'), (await win.webContents.capturePage()).toPNG());
  await waitFor(win, `!!document.querySelector('.agent-history')`, 90000);
  const result = await win.webContents.executeJavaScript(`({title: document.title, rows: [...document.querySelectorAll('.team-row')].map(el => ({status: el.className, text: el.innerText})), text: document.querySelector('#messages').innerText})`);
  fs.writeFileSync(path.join(out, 'ui-smoke-result.json'), JSON.stringify({ errors, ...result }, null, 2));
  assert.equal(result.title, 'Musical AI');
  assert.ok(result.rows.length >= 2, 'Expected two real specialists');
  assert.ok(result.rows.every(row => row.status.includes('done')));
  await waitFor(win, `document.querySelectorAll('.blur-text-word:not(.blur-text-done)').length === 0`);
  await win.webContents.executeJavaScript(`document.querySelector('#chatContainer').scrollTop = 0`);
  fs.writeFileSync(path.join(out, 'musical-agents-result.png'), (await win.webContents.capturePage()).toPNG());
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
