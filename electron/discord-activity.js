const net = require('net');
const path = require('path');
const { randomUUID } = require('crypto');
const DEFAULT_IMAGE = 'https://raw.githubusercontent.com/Kuloka/MultiMind/main/resources/multimind-logo-animated.gif';

function frame(op, value) {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(8);
  header.writeUInt32LE(op); header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function createDiscordActivity({ connect = name => net.createConnection(name), retryMs = 15000 } = {}) {
  let config = {}, socket, timer, revision = 0, state = 'disabled', message = '', ready = false;
  const started = Math.floor(Date.now() / 1000);
  const status = () => ({ state, message });
  function sendActivity() {
    if (!ready || !socket) return;
    state = 'connecting';
    const activity = { details: 'Creating with MultiMind', timestamps: { start: started }, instance: false };
    if (config.image) activity.assets = { large_image: config.image, large_text: 'MultiMind' };
    socket.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce: randomUUID() }));
  }
  function stop() {
    revision++; clearTimeout(timer);
    if (socket) {
      const previous = socket;
      if (ready) {
        previous.end(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: null }, nonce: randomUUID() }));
        const cleanup = setTimeout(() => previous.destroy(), 500); cleanup.unref?.();
      } else previous.destroy();
      socket = null;
    }
    ready = false;
    state = 'disabled'; message = '';
  }
  function attempt(index, current) {
    if (current !== revision) return;
    if (index >= 10) {
      state = 'waiting';
      timer = setTimeout(() => attempt(0, current), retryMs); timer.unref?.();
      return;
    }
    const name = process.platform === 'win32' ? `\\\\?\\pipe\\discord-ipc-${index}` : path.join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp', `discord-ipc-${index}`);
    const client = connect(name); socket = client;
    let buffer = Buffer.alloc(0), authenticated = false, rejected = false;
    const timeout = setTimeout(() => client.destroy(), 5000); timeout.unref?.();
    client.on('connect', () => client.write(frame(0, { v: 1, client_id: config.applicationId })));
    client.on('data', chunk => {
      if (current !== revision) return;
      buffer = Buffer.concat([buffer, chunk]);
      try {
        while (buffer.length >= 8) {
          const op = buffer.readUInt32LE(0), length = buffer.readUInt32LE(4);
          if (length > 1024 * 1024) throw new Error('Invalid Discord frame');
          if (buffer.length < length + 8) break;
          const body = buffer.subarray(8, length + 8); buffer = buffer.subarray(length + 8);
          if (op === 3) { client.write(frame(4, body)); continue; }
          if (op === 2) { rejected = true; state = 'error'; message = 'Discord closed the connection. Check Application ID.'; client.destroy(); break; }
          if (op !== 1) continue;
          const packet = JSON.parse(body.toString('utf8'));
          if (packet.evt === 'READY') { clearTimeout(timeout); authenticated = ready = true; sendActivity(); }
          else if (packet.evt === 'ERROR') { state = 'error'; message = String(packet.data?.message || 'Discord rejected the activity').slice(0, 200); }
          else if (packet.cmd === 'SET_ACTIVITY') { state = 'active'; message = ''; }
        }
      } catch { client.destroy(); }
    });
    client.on('error', () => {});
    client.on('close', () => {
      clearTimeout(timeout);
      if (current !== revision) return;
      ready = false; socket = null;
      if (rejected) return;
      if (authenticated) { state = 'waiting'; timer = setTimeout(() => attempt(0, current), retryMs); timer.unref?.(); }
      else attempt(index + 1, current);
    });
  }
  function configure(value = {}) {
    const next = { enabled: value.enabled === true, applicationId: '1547289218902921226', image: String(value.image || '').trim() || DEFAULT_IMAGE };
    if (JSON.stringify(config) === JSON.stringify(next)) return status();
    stop(); config = next;
    if (!next.enabled) return status();
    if (!/^\d{17,20}$/.test(next.applicationId)) { state = 'needs-id'; return status(); }
    if (next.image && !/^(https:\/\/[^\s]+|[a-zA-Z0-9_-]{1,128})$/.test(next.image)) { state = 'error'; message = 'Use an HTTPS image URL or Discord asset name.'; return status(); }
    state = 'connecting'; attempt(0, revision); return status();
  }
  return { configure, status, stop };
}
module.exports = { createDiscordActivity, frame, DEFAULT_IMAGE };
