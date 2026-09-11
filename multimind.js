(function (root) {
  'use strict';

  function cloudFetch(body, signal) {
    signal?.throwIfAborted();
    return new Promise((resolve,reject)=>{
      const id=root.crypto.randomUUID();let controller,ended=false,off=()=>{};
      const cleanup=()=>{off();signal?.removeEventListener('abort',abort);};
      const fail=error=>{if(ended)return;ended=true;controller.error(error);cleanup();reject(error);};
      const abort=()=>{root.api.cloudCancel(id);fail(new DOMException('Stopped','AbortError'));};
      const stream=new ReadableStream({start(value){controller=value;},cancel(){root.api.cloudCancel(id);ended=true;cleanup();}});
      off=root.api.onCloudEvent(event=>{
        if(event.id!==id||ended)return;
        if(event.type==='headers') {
          if(event.kind)root.dispatchEvent?.(new CustomEvent('ollama-cloud-problem',{detail:event}));
          resolve(new Response(stream,{status:event.status}));
        } else if(event.type==='chunk')controller.enqueue(new TextEncoder().encode(event.text));
        else if(event.type==='problem') {root.dispatchEvent?.(new CustomEvent('ollama-cloud-problem',{detail:event}));root.api.cloudCancel(id);fail(new Error(event.message));}
        else if(event.type==='done'){ended=true;controller.close();cleanup();}
        else if(event.type==='failed')fail(event.aborted?new DOMException(event.message,'AbortError'):new Error(event.message));
      });
      signal?.addEventListener('abort',abort,{once:true});
      root.api.cloudRequest(id,body).catch(fail);
    });
  }

  // Translate the embedded server's OpenAI stream into the existing chat format.
  async function chatFetch(url, init) {
    const body = JSON.parse(init.body);
    if (body.model.startsWith('cloud:')) return cloudFetch(body, init.signal);
    if (!body.model.startsWith('multimind:')) return fetch(url, init);
    if (root.api?.localActivate) {
      const ready = await root.api.localActivate(body.model);
      if (!ready.ok) throw new Error(ready.error || 'Could not start the local model');
      init.signal?.throwIfAborted();
    }
    const request = {
      model: body.model, messages: body.messages.map(({ role, content }) => ({ role, content })),
      stream: body.stream, max_tokens: body.options?.num_predict || 1000,
      temperature: body.options?.temperature ?? 0.7
    };
    if (body.format === 'json') request.response_format = { type: 'json_object' };
    else if (body.format && typeof body.format === 'object') request.response_format = { type: 'json_object', schema: body.format };
    const response = await fetch('http://127.0.0.1:11435/v1/chat/completions', { ...init, body: JSON.stringify(request) });
    if (!response.ok) return response;
    if (!body.stream) {
      const data = await response.json();
      return Response.json({ message: data.choices?.[0]?.message || { content: '' } });
    }
    const decoder = new TextDecoder(), encoder = new TextEncoder();
    let buffer = '';
    const convert = (line, controller) => {
      if (!line.startsWith('data:')) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') return;
      const data = JSON.parse(payload);
      if (data.error) throw new Error(data.error.message || 'Local generation failed');
      const delta = data.choices?.[0]?.delta || {};
      controller.enqueue(encoder.encode(JSON.stringify({ message: { content: delta.content || '', thinking: delta.reasoning_content || '' } }) + '\n'));
    };
    return new Response(response.body.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop();
        lines.forEach(line => convert(line.trim(), controller));
      },
      flush(controller) { buffer += decoder.decode(); convert(buffer.trim(), controller); }
    })));
  }

  async function runTeam({ messages, model, workerModels = [], concurrency = 1, signal, onUpdate, request = chatFetch }) {
    const rows = [];
    const explicitTeam = /раздели|специалист|сабагент|split|specialists|subagents/i.test(messages.filter(message => message.role === 'user').at(-1)?.content || '');
    const planSchema = {
      type: 'object', additionalProperties: false, required: ['tasks'],
      properties: { tasks: { type: 'array', minItems: explicitTeam ? 2 : 0, maxItems: 2,
        items: { type: 'object', additionalProperties: false, required: ['title', 'task'], properties: { title: { type: 'string', minLength: 1, maxLength: 80 }, task: { type: 'string', minLength: 1, maxLength: 600 } } }
      } }
    };
    const emit = () => onUpdate(rows.map(row => ({ ...row })));
    const add = (id, title, assignedModel) => { const row = { id, title, model: assignedModel, status: 'queued', task: '', output: '', elapsed: 0 }; rows.push(row); emit(); return row; };
    const run = async (row, job, json = false) => {
      signal.throwIfAborted();
      row.status = 'working'; row.started = Date.now(); emit();
      const ticker = setInterval(() => { row.elapsed = Date.now() - row.started; emit(); }, 1000);
      try {
        const response = await request('http://127.0.0.1:11434/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
          body: JSON.stringify({ model: row.model, messages: job, stream: !json, ...(json ? { format: planSchema } : {}), options: { num_predict: json ? 700 : 900, num_ctx: 8192, temperature: json ? 0 : 0.5 } })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 180)}`);
        if (json) {
          const result = await response.json();
          if (result.error) throw new Error(result.error);
          row.output = String(result.message?.content || '');
        } else {
          const reader = response.body.getReader(), decoder = new TextDecoder();
          let buffer = '', lastUpdate = 0;
          const line = value => {
            if (!value.trim()) return;
            const result = JSON.parse(value);
            if (result.error) throw new Error(result.error);
            row.output += result.message?.content || '';
            if (Date.now() - lastUpdate > 120) { emit(); lastUpdate = Date.now(); }
          };
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            buffer += decoder.decode(part.value, { stream: true });
            const lines = buffer.split('\n'); buffer = lines.pop(); lines.forEach(line);
          }
          line(buffer + decoder.decode());
        }
        row.output = row.output.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (!row.output) throw new Error('Empty agent response');
        row.status = 'done';
        return row.output;
      } catch (error) {
        row.status = signal.aborted ? 'stopped' : 'error'; row.output = error.message;
        if (signal.aborted) throw error;
        return null;
      } finally { clearInterval(ticker); row.elapsed = Date.now() - row.started; emit(); }
    };
    const planner = add('planner', 'Coordinator', model);
    const planText = await run(planner, [
      { role: 'system', content: 'Split the user request into at most TWO independent useful subtasks. Return JSON only: {"tasks":[{"title":"short name","task":"specific instructions"}]}. Use the user language for titles and instructions. When the user explicitly asks to split the work between specialists, return exactly two tasks. Otherwise for a simple question, greeting, translation, or indivisible task return {"tasks":[]}. Workers cannot read files, execute code or browse; they only analyze the supplied context and draft answers/code. Never claim they tested or changed anything.' },
      ...messages.filter(message => message.role !== 'system')
    ], true);
    signal.throwIfAborted();
    let tasks = [];
    try {
      const plan = JSON.parse((planText || '').replace(/^```(?:json)?\s*|\s*```$/g, ''));
      if (Array.isArray(plan.tasks)) tasks = plan.tasks.filter(task => typeof task.title === 'string' && typeof task.task === 'string' && task.task.trim()).slice(0, 2);
    } catch { planner.status = 'error'; planner.output = 'Could not split the request; continuing with the main model.'; emit(); }
    if (tasks.length < 2) return { context: '', rows };
    const workers = tasks.map((task, i) => {
      const row = add(`worker-${i}`, task.title.slice(0, 100), workerModels[i] || model);
      row.task = task.task.slice(0, 4000); return row;
    });
    emit();
    let cursor = 0;
    const consume = async () => {
      while (cursor < workers.length) {
        signal.throwIfAborted();
        const row = workers[cursor++];
        await run(row, [
          { role: 'system', content: 'You are a specialist assisting with one part of a request. Produce a concise, useful draft in the user language. You have no tools: do not claim to read files, edit them, run tests, or search online. Focus only on the assigned subtask.' },
          ...messages.filter(message => message.role !== 'system'),
          { role: 'user', content: `Your assigned subtask: ${row.task}` }
        ]);
      }
    };
    try { await Promise.all(Array.from({ length: Math.max(1, Math.min(2, concurrency)) }, consume)); }
    finally { if (signal.aborted) { workers.filter(row => row.status === 'queued').forEach(row => { row.status = 'stopped'; }); emit(); } }
    signal.throwIfAborted();
    const drafts = workers.filter(row => row.status === 'done').map(row => `${row.title}:\n${row.output}`).join('\n\n');
    return { context: drafts ? `Specialist drafts (unverified; assess critically, reconcile contradictions, and answer the original request as one coherent response; do not claim tools were executed):\n${drafts}` : '', rows };
  }
  function shouldShowSetup(local, modelCount, completed) {
    if (['manifest', 'windows', 'windows-install', 'engine', 'extracting', 'model', 'starting'].includes(local.stage)) return true;
    return !(local.installed || local.running || modelCount > 0 || completed === true);
  }
  const api = { chatFetch, runTeam, shouldShowSetup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MultiMind = api;
})(typeof window !== 'undefined' ? window : globalThis);
