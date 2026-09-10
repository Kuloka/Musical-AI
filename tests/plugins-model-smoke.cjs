const fs=require('fs/promises'),path=require('path'),assert=require('assert/strict');
const {createLocalRuntime,MODEL}=require('../electron/local-runtime');
const {createPlugins}=require('../electron/mcp-plugins');
const {run}=require('../plugins-chat');
const root=path.resolve(__dirname,'..','artifacts');
const runtime=createLocalRuntime(path.join(root,'runtime-test'),{port:11439});
const plugins=createPlugins(path.join(root,'plugin-model-test'),path.join(root,'plugin-model-projects'));
(async()=>{
  await fs.mkdir(path.join(root,'plugin-model-projects','DemoMCP'),{recursive:true});
  await runtime.start(MODEL);
  for(const entry of plugins.list())await plugins.remove(entry.id);
  const [entry]=await plugins.add({type:'builtin',name:'Workspace'});const [ready]=await plugins.toggle(entry.id,true);assert.equal(ready.state,'connected');
  let calls=0;
  const request=async(_url,init)=>{
    const body=JSON.parse(init.body);const response=await fetch('http://127.0.0.1:11439/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages:body.messages,stream:false,temperature:0,max_tokens:300,response_format:{type:'json_object'}})});
    if(!response.ok)throw Error('Model HTTP '+response.status);const data=await response.json();return Response.json({message:data.choices[0].message});
  };
  const context=await run({messages:[{role:'user',content:'Use the Workspace plugin to list my local project folders.'}],model:MODEL,tools:ready.tools.map(t=>({...t,pluginId:ready.id,pluginName:ready.name})),request,authorize:async()=>true,execute:async(tool,args)=>{calls++;return plugins.call(tool.pluginId,tool.name,args,'smoke-'+calls);},onStatus:console.log});
  assert.ok(calls>0);assert.match(context,/DemoMCP/);
  const answer=await fetch('http://127.0.0.1:11439/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages:[{role:'user',content:'Which project folders do I have?\n'+context}],stream:false,temperature:0,max_tokens:150})});
  const answerData=await answer.json();assert.match(answerData.choices[0].message.content,/DemoMCP/);
  console.log('PASS: Qwen 1.5B selected and called a real MCP tool; returned DemoMCP');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{runtime.stop();await plugins.close();});
