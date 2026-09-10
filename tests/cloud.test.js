const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {createCloud,classify}=require('../electron/ollama-cloud');
test('Cloud classifies auth, billing and rate limits separately',()=>{
  assert.equal(classify(401,'credits'),'auth');assert.equal(classify(402),'billing');
  assert.equal(classify(429,'Too many concurrent requests'),'rate');
  assert.equal(classify(429,'usage limit reached'),'billing');assert.equal(classify(403,'forbidden'),'access');
});
test('Cloud credentials stay out of status, catalog is live and chat forwards bearer auth and chunks',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'musical-cloud-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const storage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s.split('').reverse().join('')),decryptString:b=>b.toString().split('').reverse().join('')};
  let calls=0;const cloud=createCloud(dir,storage,async(url,init)=>{
    if(url.endsWith('/tags'))return Response.json({models:[{name:'test-model'}]});
    assert.equal(url,'https://ollama.com/api/chat');assert.equal(init.headers.Authorization,'Bearer fixture-key');
    assert.equal(JSON.parse(init.body).model,'test-model');calls++;
    return new Response('{"message":{"content":"Hello"}}\n{"done":true}\n');
  });
  cloud.save('fixture-key');assert.deepEqual(cloud.status(),{configured:true});
  assert.ok(!(await fs.readFile(path.join(dir,'ollama-cloud.key'),'utf8')).includes('fixture-key'));
  assert.equal((await cloud.models())[0].name,'cloud:test-model');
  const events=[];await cloud.chat({model:'cloud:test-model',messages:[{role:'user',content:'Hello'}]},undefined,e=>events.push(e));
  assert.equal(calls,1);assert.equal(events[0].status,200);assert.match(events.find(e=>e.type==='chunk').text,/Hello/);assert.equal(events.at(-1).type,'done');
  cloud.disconnect();assert.equal(cloud.status().configured,false);
  const missing=[];await cloud.chat({},undefined,e=>missing.push(e));assert.equal(missing[0].kind,'auth');
});
test('Cloud returns a billing event for HTTP 402 without leaking a key',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'musical-cloud-error-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const storage={isEncryptionAvailable:()=>true,encryptString:Buffer.from,decryptString:b=>b.toString()};
  const cloud=createCloud(dir,storage,async()=>Response.json({error:'fixture-key insufficient credits'},{status:402}));cloud.save('fixture-key');
  const events=[];await cloud.chat({model:'cloud:test',messages:[]},undefined,e=>events.push(e));assert.equal(events[0].kind,'billing');assert.ok(!JSON.stringify(events).includes('fixture-key'));
});

test('Cloud renderer bridge streams responses and cancels pending requests',async t=>{
  const previous=globalThis.api;let listener,cancelled=false;
  t.after(()=>{globalThis.api=previous;});
  globalThis.api={onCloudEvent:cb=>{listener=cb;return()=>{};},cloudCancel:()=>{cancelled=true;},cloudRequest:async id=>{
    listener({id,type:'headers',status:200});listener({id,type:'chunk',text:'{"message":{"content":"Привет"}}\n'});listener({id,type:'done'});
  }};
  const {chatFetch}=require('../musical-ai');
  const response=await chatFetch('',{body:JSON.stringify({model:'cloud:test',messages:[]})});assert.match(await response.text(),/Привет/);
  globalThis.api.cloudRequest=async id=>{listener({id,type:'headers',status:200});};
  const controller=new AbortController();const pending=await chatFetch('',{body:JSON.stringify({model:'cloud:test',messages:[]}),signal:controller.signal});
  controller.abort();await assert.rejects(pending.text(),{name:'AbortError'});assert.equal(cancelled,true);
});
