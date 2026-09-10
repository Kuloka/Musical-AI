const {app,BrowserWindow}=require('electron');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts');
app.setPath('userData',path.join(out,'site-test-profile'));
const motion=process.argv.includes('--motion');
if(!motion)app.commandLine.appendSwitch('force-prefers-reduced-motion','reduce');
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1440,height:1050,show:false,frame:false,webPreferences:{offscreen:true}});const errors=[];
  win.webContents.on('console-message',(_e,level,message)=>{if(level===3&&!/Content Security/.test(message))errors.push(message);});
  await win.loadFile(path.join(root,'docs','index.html'));
  await new Promise(resolve=>setTimeout(resolve,350));
  if(motion){
    await new Promise(resolve=>setTimeout(resolve,1600));
    assert.ok(await win.webContents.executeJavaScript("!!document.querySelector('#antigravity canvas')"));
    await win.webContents.executeJavaScript("const card=document.querySelector('.button');const r=card.getBoundingClientRect();card.dispatchEvent(new PointerEvent('pointermove',{clientX:r.right-2,clientY:r.top+r.height/2,pointerType:'mouse'}));");
    assert.ok(await win.webContents.executeJavaScript("Number(document.querySelector('.button').style.getPropertyValue('--edge-proximity'))>90"));
    fs.writeFileSync(path.join(out,'musical-site-motion.png'),(await win.webContents.capturePage()).toPNG());
  }
  assert.equal(await win.webContents.executeJavaScript('document.documentElement.scrollWidth <= innerWidth'),true);
  assert.ok(await win.webContents.executeJavaScript("[...document.images].every(image=>image.complete&&image.naturalWidth>0)"));
  await win.webContents.executeJavaScript("document.querySelector('#tab-cloud').click()");
  assert.equal(await win.webContents.executeJavaScript("document.querySelector('#tab-cloud').getAttribute('aria-selected')"),'true');
  assert.match(await win.webContents.executeJavaScript("document.querySelector('#demo-content').textContent"),/API/);
  fs.writeFileSync(path.join(out,'musical-site-desktop.png'),(await win.webContents.capturePage()).toPNG());
  const height=await win.webContents.executeJavaScript('document.documentElement.scrollHeight');
  win.setSize(1440,height);await new Promise(resolve=>setTimeout(resolve,200));
  fs.writeFileSync(path.join(out,'musical-site-full.png'),(await win.webContents.capturePage()).toPNG());
  win.setSize(390,844);await new Promise(resolve=>setTimeout(resolve,250));
  assert.equal(await win.webContents.executeJavaScript('document.documentElement.scrollWidth <= innerWidth'),true);
  fs.writeFileSync(path.join(out,'musical-site-mobile.png'),(await win.webContents.capturePage()).toPNG());
  for(const code of ['en','ru','es','pt','fr','de','it','tr','pl','uk']){
    await win.webContents.executeJavaScript(`document.querySelector('#language-toggle').click();document.querySelector('[data-language="${code}"]').click()`);
    assert.equal(await win.webContents.executeJavaScript('document.documentElement.lang'),code);
    assert.equal(await win.webContents.executeJavaScript('document.documentElement.scrollWidth <= innerWidth'),true,code+' mobile overflow');
    await win.webContents.executeJavaScript("document.querySelector('#tab-cloud').click()");
    assert.match(await win.webContents.executeJavaScript("document.querySelector('#demo-content').textContent"),/API/);
    assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.download-grid a').length"),6);
  }
  await win.webContents.reload();await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(await win.webContents.executeJavaScript('document.documentElement.lang'),'uk');
  await win.webContents.executeJavaScript("document.querySelector('#language-toggle').click();document.querySelector('[data-language=en]').click();document.querySelector('#language-toggle').click();");
  await new Promise(resolve=>setTimeout(resolve,250));
  await win.webContents.executeJavaScript("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))");
  assert.equal(await win.webContents.executeJavaScript('document.activeElement.dataset.language'),'uk',JSON.stringify(await win.webContents.executeJavaScript("({active:document.activeElement.outerHTML.slice(0,250),open:document.getElementById('language-toggle').getAttribute('aria-expanded'),inert:document.getElementById('language-options').inert,visibility:getComputedStyle(document.getElementById('language-options')).visibility})")));
  await win.webContents.executeJavaScript("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  assert.equal(await win.webContents.executeJavaScript("document.querySelector('#language-toggle').getAttribute('aria-expanded')"),'false');
  win.setSize(1440,1050);
  await win.webContents.executeJavaScript("document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));document.querySelector('#download').scrollIntoView({behavior:'instant'})");
  await new Promise(resolve=>setTimeout(resolve,300));
  fs.writeFileSync(path.join(out,'musical-site-downloads.png'),(await win.webContents.capturePage()).toPNG());
  assert.ok(await win.webContents.executeJavaScript("[...document.querySelectorAll('a[href^=\"#\"]')].every(a=>a.hash===''||document.getElementById(a.hash.slice(1)))"));
  assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile, 10 languages, persistence, keyboard menu, feature tabs, six downloads, no console errors');win.destroy();app.quit();
}).catch(error=>{console.error(error.message);app.exit(1);});
