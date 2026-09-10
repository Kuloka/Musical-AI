const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 fs.mkdirSync('artifacts/cloudflare-browser',{recursive:true});
 const browser=await chromium.launch();
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
   const page=await context.newPage(),errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('requestfailed',r=>requests.push({url:r.url(),error:r.failure()?.errorText}));
   const response=await page.goto('https://musical-ai.pages.dev/',{waitUntil:'domcontentloaded',timeout:60000});
   if(response.status()!==200)throw Error('Page status '+response.status());
   await page.locator('h1').waitFor({state:'visible'});
   await page.locator('#language-toggle').click();
   await page.locator('[data-language="tr"]').click();
   if(await page.locator('html').getAttribute('lang')!=='tr')throw Error('Language switch failed');
   await page.locator('#tab-cloud').click();
   if(await page.locator('#tab-cloud').getAttribute('aria-selected')!=='true')throw Error('Tabs failed');
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:`artifacts/cloudflare-browser/${mobile?'mobile':'desktop'}.png`});
   fs.writeFileSync(`artifacts/cloudflare-browser/${mobile?'mobile':'desktop'}.json`,JSON.stringify({status:response.status(),title:await page.title(),errors,requests},null,2));
   if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));
   console.log('PASS: '+(mobile?'mobile':'desktop')+' Cloudflare browser loads, switches to Turkish and opens Cloud tab.');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
