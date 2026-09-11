const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
for(const file of ['locales.js','locales-west.js','locales-east.js','render.js'])require(path.join(root,file));
const c=SITE_COPY.en;
fs.writeFileSync(path.join(root,'index.html'),`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.meta[0]}</title><meta name="description" content="${c.meta[1]}">
<meta name="theme-color" content="#101010"><meta property="og:title" content="${c.meta[0]}"><meta property="og:description" content="${c.meta[1]}"><meta property="og:type" content="website"><meta property="og:image" content="https://multimind-ai.pages.dev/assets/social.png">
<link rel="icon" href="assets/logo.svg" type="image/svg+xml"><link rel="canonical" href="https://multimind-ai.pages.dev/">
<style>${fs.readFileSync(path.join(root,'site.css'),'utf8')}\n${fs.readFileSync(path.join(root,'effects.css'),'utf8')}</style>
</head><body><div id="page">${siteMarkup('en').replace('class="language-picker"','class="language-picker" hidden')}</div><script>${fs.readFileSync(path.join(__dirname,'boot.js'),'utf8')}</script></body></html>\n`);
console.log('Built static English page with 10 complete language packs');
