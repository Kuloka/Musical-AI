const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

function createPlugins(directory, projectsRoot) {
  const file = path.join(directory, 'plugins.json');
  const entries = new Map(), calls = new Map();
  try { for (const config of JSON.parse(fs.readFileSync(file, 'utf8'))) entries.set(config.id, { config, state:'disabled', tools:[] }); } catch {}
  const save = () => { fs.mkdirSync(directory,{recursive:true}); fs.writeFileSync(file,JSON.stringify([...entries.values()].map(e=>e.config),null,2)); };
  const list = () => [...entries.values()].map(e=>({ ...e.config, state:e.state, error:e.error || '', tools:e.tools }));
  async function disconnect(entry) {
    const client=entry.client; entry.client=null; entry.tools=[]; entry.state='disabled';
    for(const call of calls.values()) if(call.pluginId===entry.config.id) call.controller.abort();
    if(client) await client.close().catch(()=>{});
  }
  async function connect(entry) {
    await disconnect(entry);
    if(!entry.config.enabled) return;
    const client=new Client({name:'Musical-AI',version:'1.19.0'});
    entry.client=client; entry.state='connecting'; entry.error='';
    const config=entry.config;
    try {
      const transport=config.type==='http' ? new StreamableHTTPClientTransport(new URL(config.url)) : new StdioClientTransport(config.type==='builtin' ? {
        command:process.execPath,args:[path.join(__dirname,'workspace-mcp.js'),projectsRoot],env:{ELECTRON_RUN_AS_NODE:'1'},stderr:'pipe'
      } : {command:config.command,args:config.args,stderr:'pipe'});
      transport.stderr?.on('data',()=>{});
      await client.connect(transport,{timeout:15000});
      let cursor; const tools=[];
      do {
        const page=await client.listTools(cursor ? {cursor} : {},{timeout:15000});
        tools.push(...page.tools); cursor=page.nextCursor;
        if(tools.length>100) throw new Error('A connection can expose at most 100 tools.');
      } while(cursor);
      if(entry.client!==client || !config.enabled) { await client.close(); return; }
      entry.tools=tools.map(t=>({name:t.name,description:(t.description||'').slice(0,2000),inputSchema:t.inputSchema}));
      entry.state='connected';
      client.onclose=()=>{if(entry.client===client){entry.state='disconnected';entry.tools=[];entry.client=null;}};
    } catch(error) {
      if(entry.client===client){entry.state='error';entry.error=String(error.message).slice(0,400);entry.tools=[];entry.client=null;}
      await client.close().catch(()=>{});
    }
  }
  async function add(input) {
    if(entries.size>=20) throw new Error('Maximum 20 connections.');
    if(!['builtin','stdio','http'].includes(input.type))throw new Error('Unknown transport.');
    const config={id:randomUUID(),name:String(input.name||'MCP').trim().slice(0,80),type:input.type,enabled:false};
    if(input.type==='http') {
      const url=new URL(input.url);
      if(url.protocol!=='https:' && !(url.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new Error('Use HTTPS, or HTTP on localhost.');
      if(url.username || url.password)throw new Error('Credentials in URLs are not supported.');
      config.url=url.href;
    } else if(input.type==='stdio') {
      if(typeof input.command!=='string'||!input.command.trim())throw new Error('Executable required.');
      if(!Array.isArray(input.args)||input.args.some(a=>typeof a!=='string')||JSON.stringify(input.args).length>8000)throw new Error('Arguments must be a JSON array of strings.');
      config.command=input.command.trim();config.args=input.args;
    }
    entries.set(config.id,{config,state:'disabled',tools:[]});save();return list();
  }
  async function toggle(id,enabled) {
    const entry=entries.get(id);if(!entry)throw new Error('Unknown connection.');
    entry.config.enabled=!!enabled;save();if(enabled)await connect(entry);else await disconnect(entry);return list();
  }
  async function remove(id) { const entry=entries.get(id);if(entry){entry.config.enabled=false;await disconnect(entry);entries.delete(id);save();}return list(); }
  async function call(id,name,args,requestId) {
    const entry=entries.get(id);
    if(!entry?.config.enabled||entry.state!=='connected'||!entry.tools.some(t=>t.name===name))throw new Error('Tool is not available.');
    if(!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>32000)throw new Error('Invalid tool arguments.');
    if(calls.has(requestId))throw new Error('Duplicate call.');
    const controller=new AbortController();calls.set(requestId,{controller,pluginId:id});
    try {
      const result=await entry.client.callTool({name,arguments:args},undefined,{signal:controller.signal,timeout:30000});
      return {isError:!!result.isError,text:(result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n').slice(0,24000) || (result.structuredContent ? JSON.stringify(result.structuredContent).slice(0,24000) : '[Tool returned no text content]')};
    } finally {calls.delete(requestId);}
  }
  return {list,add,toggle,remove,call,cancel:id=>calls.get(id)?.controller.abort(),start:()=>Promise.allSettled([...entries.values()].filter(e=>e.config.enabled).map(connect)),close:()=>Promise.allSettled([...entries.values()].map(disconnect))};
}
module.exports={createPlugins};
