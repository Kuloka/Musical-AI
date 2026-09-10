const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
require('../docs/locales');require('../docs/locales-west');require('../docs/locales-east');require('../docs/render');
function shape(value){return Array.isArray(value)?value.map(shape):typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,shape(v)])):typeof value;}
test('All desktop languages have complete website copy and six native download links',()=>{
 const renderer=fs.readFileSync(require.resolve('../renderer.js'),'utf8');
 const codes=[...renderer.match(/const APP_LANGUAGES = \[([\s\S]*?)\];/)[1].matchAll(/code: "(\w+)"/g)].map(m=>m[1]);
 assert.deepEqual(Object.keys(SITE_LANGUAGES).sort(),codes.sort());
 for(const code of codes){assert.deepEqual(shape(SITE_COPY[code]),shape(SITE_COPY.en),code);const html=siteMarkup(code);assert.ok(!html.includes('undefined'),code);assert.equal((html.match(/releases\/download\//g)||[]).length,6);}
 assert.match(fs.readFileSync(require.resolve('../docs/index.html'),'utf8'),/<html lang="en">/);
});
