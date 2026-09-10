const { app, BrowserWindow } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('node:assert/strict');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'musical-native-smoke-'));
os.homedir = () => temp;
app.setPath('userData', path.join(temp, 'profile'));
const unpacked = process.platform === 'win32' ? 'win-unpacked/resources' : process.platform === 'linux' ? 'linux-unpacked/resources' : `mac${process.arch === 'arm64' ? '-arm64' : ''}/Musical AI.app/Contents/Resources`;
const asar = path.resolve(__dirname, '../dist', unpacked, 'app.asar');
assert.ok(fs.existsSync(asar), asar);
const deadline = setTimeout(() => { console.error('Application launch timed out'); app.exit(1); }, 30000);
app.on('web-contents-created', (_event, contents) => {
  contents.once('did-finish-load', async () => {
    try {
      assert.equal(await contents.executeJavaScript("document.title.includes('Musical')"), true);
      assert.equal(await contents.executeJavaScript("!!document.getElementById('settingsBtn') || !!document.querySelector('.settings-btn')"), true);
      assert.ok(BrowserWindow.getAllWindows().length);
      console.log(`PASS: packaged app loads on ${process.platform}/${process.arch}`);
      clearTimeout(deadline); app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
});
require(path.join(asar, 'electron/main.js'));
