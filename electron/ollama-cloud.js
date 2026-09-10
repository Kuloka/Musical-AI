const fs=require('fs');
const path=require('path');
function classify(status,message='') {
  if(status===401)return 'auth';
  if(status===402)return 'billing';
  if((status===403||status===429||status===0)&&/credit|quota|subscription|billing|balance|usage limit|payment/i.test(message))return 'billing';
  if(status===429)return 'rate';
  if(status===403)return 'access';
  return 'error';
}
function createCloud(directory,safeStorage,request=fetch) {
  const file=path.join(directory,'ollama-cloud.key');let cached=[];let checked=0;
  const configured=()=>fs.existsSync(file);
  function key(){if(!configured())return '';return safeStorage.decryptString(fs.readFileSync(file));}
  function save(value){
    if(typeof value!=='string'||value.trim().length<8||value.length>4096||/[\r\n]/.test(value))throw new Error('Enter a valid Ollama API key.');
    if(!safeStorage.isEncryptionAvailable())throw new Error('Secure credential storage is unavailable.');
    fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(file,safeStorage.encryptString(value.trim()));return {configured:true};
  }
  async function models(force=false){
    if(cached.length&&!force&&Date.now()-checked<300000)return cached;
    const response=await request('https://ollama.com/api/tags',{signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)throw new Error('Ollama catalog HTTP '+response.status);
    const data=await response.json();cached=(data.models||[]).filter(m=>typeof m.name==='string'&&/^[a-zA-Z0-9_.:/-]{1,160}$/.test(m.name)).map(m=>({name:'cloud:'+m.name,cloudName:m.name,size:0,backend:'cloud',details:m.details||{}}));checked=Date.now();return cached;
  }
  async function chat(body,signal,emit){
    const token=key();
    async function fail(status,message){const kind=classify(status,message);emit({type:'headers',status,kind,message});emit({type:'chunk',text:JSON.stringify({error:message})});emit({type:'done'});}
    if(!token){await fail(401,'Connect your Ollama account in Settings > Ollama Cloud.');return;}
    if(!body||typeof body.model!=='string'||!body.model.startsWith('cloud:')||!Array.isArray(body.messages))throw new Error('Invalid cloud request.');
    const payload={model:body.model.slice(6),messages:body.messages,stream:body.stream!==false};
    for(const field of ['options','format','think'])if(body[field]!==undefined)payload[field]=body[field];
    const response=await request('https://ollama.com/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(payload),signal,redirect:'error'});
    if(!response.ok){const raw=await response.text();let message;try{message=JSON.parse(raw).error;}catch{}await fail(response.status,String(message||raw||response.statusText).replaceAll(token,'[redacted]').slice(0,800));return;}
    emit({type:'headers',status:200});
    const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',bytes=0;
    try {
      while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>20000000)throw new Error('Cloud response is too large.');
        const text=decoder.decode(value,{stream:true});emit({type:'chunk',text});pending+=text;
        const lines=pending.split('\n');pending=lines.pop();
        for(const line of lines){try{const data=JSON.parse(line);if(data.error)emit({type:'problem',kind:classify(0,data.error),message:String(data.error).replaceAll(token,'[redacted]').slice(0,800)});}catch{}}
      }
      const tail=decoder.decode();if(tail)emit({type:'chunk',text:tail});
      try{const data=JSON.parse(pending+tail);if(data.error)emit({type:'problem',kind:classify(0,data.error),message:String(data.error).replaceAll(token,'[redacted]').slice(0,800)});}catch{}
      emit({type:'done'});
    }finally{await reader.cancel().catch(()=>{});}
  }
  return {save,models,chat,status:()=>({configured:configured()}),disconnect:()=>{if(configured())fs.unlinkSync(file);return {configured:false};}};
}
module.exports={createCloud,classify};
