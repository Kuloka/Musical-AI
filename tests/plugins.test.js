const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createPlugins}=require('../electron/mcp-plugins');
const {run}=require('../plugins-chat');

test('Real stdio MCP discovery, project reads, traversal refusal, persistence and disable',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'multimind-mcp-'));
  const projects=path.join(dir,'projects');await fs.mkdir(path.join(projects,'Demo'),{recursive:true});await fs.writeFile(path.join(projects,'Demo','note.txt'),'MCP round trip');
  const plugins=createPlugins(dir,projects);t.after(async()=>{await plugins.close();await fs.rm(dir,{recursive:true,force:true});});
  let list=await plugins.add({type:'builtin',name:'Workspace'});const id=list[0].id;
  assert.equal(list[0].enabled,false);
  list=await plugins.toggle(id,true);assert.equal(list[0].state,'connected',list[0].error);assert.equal(list[0].tools.length,3);
  assert.match((await plugins.call(id,'list_projects',{},'one')).text,/Demo/);
  assert.equal((await plugins.call(id,'read_text_file',{path:'Demo/note.txt'},'two')).text,'MCP round trip');
  assert.equal((await plugins.call(id,'read_text_file',{path:'../plugins.json'},'escape')).isError,true);
  await plugins.toggle(id,false);await assert.rejects(plugins.call(id,'list_projects',{},'disabled'),/not available/);
  assert.equal(createPlugins(dir,projects).list()[0].enabled,false);
});

test('Tool planner passes returned data to answer context and respects denial and cancellation',async()=>{
  const tools=[{name:'list_projects',pluginId:'p',pluginName:'Workspace',inputSchema:{type:'object'}}];
  let requests=0,calls=0;
  const request=async()=>Response.json({message:{content:JSON.stringify(requests++===0?{tool:'tool_0',arguments:{}}:{tool:null,arguments:{}})}});
  const context=await run({messages:[{role:'user',content:'List projects'}],model:'test',tools,request,authorize:async()=>true,execute:async()=>{calls++;return {text:'Demo/',isError:false};}});
  assert.equal(calls,1);assert.match(context,/Demo/);
  requests=0;await run({messages:[],model:'test',tools,request,authorize:async()=>false,execute:async()=>{calls++;}});assert.equal(calls,1);
  const controller=new AbortController();controller.abort();
  await assert.rejects(run({messages:[],model:'test',tools,request,signal:controller.signal}),{name:'AbortError'});
});

test('Streamable HTTP MCP discovery and execution',async t=>{
  const http=require('node:http');const {randomUUID}=require('node:crypto');
  const {Server}=require('@modelcontextprotocol/sdk/server/index.js');
  const {StreamableHTTPServerTransport}=require('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const {ListToolsRequestSchema,CallToolRequestSchema}=require('@modelcontextprotocol/sdk/types.js');
  const server=new Server({name:'HTTP-test',version:'1.0.0'},{capabilities:{tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'ping',description:'Read a greeting',inputSchema:{type:'object',properties:{}}}]}));
  server.setRequestHandler(CallToolRequestSchema,async()=>({content:[{type:'text',text:'MCP over HTTP'}]}));
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:randomUUID});await server.connect(transport);
  const listener=http.createServer((req,res)=>transport.handleRequest(req,res));
  await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'multimind-http-'));const plugins=createPlugins(dir,dir);
  t.after(async()=>{await plugins.close();await server.close();await new Promise(resolve=>listener.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
  const [entry]=await plugins.add({name:'HTTP test',type:'http',url:`http://127.0.0.1:${listener.address().port}/mcp`});
  const [ready]=await plugins.toggle(entry.id,true);assert.equal(ready.state,'connected',ready.error);
  assert.equal((await plugins.call(entry.id,'ping',{},'http')).text,'MCP over HTTP');
});
