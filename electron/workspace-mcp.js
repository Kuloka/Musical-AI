const fs=require('fs/promises');
const path=require('path');
const {Server}=require('@modelcontextprotocol/sdk/server/index.js');
const {StdioServerTransport}=require('@modelcontextprotocol/sdk/server/stdio.js');
const {ListToolsRequestSchema,CallToolRequestSchema}=require('@modelcontextprotocol/sdk/types.js');
const root=path.resolve(process.argv[2]);
const server=new Server({name:'MultiMind-Workspace',version:'1.0.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[
  {name:'list_projects',description:'List local project folders in MultiMindProject.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'list_files',description:'List files in a project folder. Path is relative to MultiMindProject.',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}},
  {name:'read_text_file',description:'Read a UTF-8 text file inside MultiMindProject (maximum 32 KB).',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}}
]}));
async function safePath(relative) {
  if(typeof relative!=='string'||path.isAbsolute(relative))throw new Error('Use a relative project path.');
  const realRoot=await fs.realpath(root), target=await fs.realpath(path.resolve(root,relative));
  const rel=path.relative(realRoot,target);
  if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw new Error('Path must stay inside MultiMindProject.');
  return target;
}
server.setRequestHandler(CallToolRequestSchema,async request=>{
  try {
    const {name,arguments:args={}}=request.params;let text;
    if(name==='list_projects'||name==='list_files') {
      const directory=await safePath(name==='list_projects'?'':args.path);
      const files=await fs.readdir(directory,{withFileTypes:true});
      text=files.filter(f=>!f.isSymbolicLink()&&(name!=='list_projects'||f.isDirectory())).slice(0,200).map(f=>f.name+(f.isDirectory()?'/':'')).join('\n')||'(empty)';
    } else if(name==='read_text_file') {
      const file=await safePath(args.path);const stat=await fs.stat(file);
      if(!stat.isFile()||stat.size>32000)throw new Error('Choose a text file smaller than 32 KB.');
      const bytes=await fs.readFile(file);if(bytes.includes(0))throw new Error('Binary files are not supported.');text=bytes.toString('utf8');
    } else throw new Error('Unknown tool.');
    return {content:[{type:'text',text}]};
  } catch(error){return {isError:true,content:[{type:'text',text:error.message}]};}
});
server.connect(new StdioServerTransport()).catch(()=>process.exit(1));
