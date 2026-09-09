const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { createDiscordActivity, frame, DEFAULT_IMAGE } = require('../electron/discord-activity');
const { prepareMedia, readMedia } = require('../electron/discord-media');

test('Discord uses built-in ID, handles split frames and ping, clears activity when disabled', () => {
  const socket = new EventEmitter(), writes = [];
  socket.write = data => writes.push(data);
  socket.destroy = () => socket.emit('close');
  socket.end = data => { writes.push(data); socket.emit('close'); };
  const rpc = createDiscordActivity({ connect: () => socket });
  rpc.configure({ enabled: true }); socket.emit('connect');
  assert.equal(JSON.parse(writes[0].subarray(8)).client_id, '1547289218902921226');
  const ready = frame(1, { evt: 'READY' });
  socket.emit('data', ready.subarray(0, 5)); socket.emit('data', ready.subarray(5));
  assert.equal(JSON.parse(writes[1].subarray(8)).cmd, 'SET_ACTIVITY');
  assert.equal(JSON.parse(writes[1].subarray(8)).args.activity.assets.large_image, DEFAULT_IMAGE);
  socket.emit('data', frame(1, { cmd: 'SET_ACTIVITY', data: {} }));
  assert.equal(rpc.status().state, 'active');
  socket.emit('data', frame(3, Buffer.from('ping')));
  assert.equal(writes.at(-1).readUInt32LE(), 4);
  rpc.configure({ enabled: false });
  assert.equal(JSON.parse(writes.at(-1).subarray(8)).args.activity, null);
  assert.equal(rpc.status().state, 'disabled');
});

test('Activity media shrinks large images, flags small images, preserves GIF frames and delays', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'musical-media-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'large.png'), output = path.join(dir, 'prepared');
  await sharp({ create: { width: 2048, height: 1024, channels: 4, background: '#777' } }).png().toFile(source);
  const large = await prepareMedia(source, output);
  assert.equal(large.width, 1024); assert.equal(large.height, 512); assert.equal(large.resized, true);
  const small = path.join(dir, 'small.png');
  await sharp({ create: { width: 64, height: 64, channels: 4, background: '#777' } }).png().toFile(small);
  assert.equal((await prepareMedia(small, output)).small, true);
  const gif = await prepareMedia(path.resolve('resources/musical-logo-animated.gif'), output);
  const meta = await sharp(Buffer.from(gif.preview.split(',')[1], 'base64'), { animated: true }).metadata();
  assert.equal(meta.pages, 64); assert.ok(meta.delay.every(delay => delay === 50));
  assert.equal((await readMedia(output)).animated, true);
});
