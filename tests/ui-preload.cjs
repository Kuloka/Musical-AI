const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  dataGet: async () => ({ groups: [], chats: [] }), dataSave: async () => ({}),
  settingsGet: async () => ({ appLanguage: 'ru', theme: 'dark', teamEnabled: true, downloadedLanguages: ['en', 'ru'] }), settingsSave: async () => ({}),
  ollamaStatus: async () => ({ running: false, models: [] }),
  localStatus: () => ipcRenderer.invoke('test:status'),
  localSetup: () => ipcRenderer.invoke('test:setup'),
  localPull: model => ipcRenderer.invoke('test:pull', model),
  onLocalProgress: () => () => {},
  fluxStatus: async () => ({ ok: true, variants: [] }),
  getProjectsRoot: async () => 'TestProjects',
  ensureProjectFolder: async name => ({ folderName: name, path: 'TestProjects/' + name }),
  projectFileExists: async () => ({ exists: false }),
  writeProjectFile: async () => ({ ok: true }),
  internetSearch: async () => ({ results: [] }),
  onInternetSearchProgress: () => () => {},
  onPullProgress: cb => { ipcRenderer.on('test:pull-progress', (_event, data) => cb(data)); return () => {}; }, onFluxProgress: () => () => {}, onFluxGenerateProgress: () => () => {}
});
