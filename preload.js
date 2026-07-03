const { contextBridge, ipcRenderer, webUtils } = require('electron');

// expose the saved config synchronously so the <head> can theme before paint
let bootConfig = {};
try {
  bootConfig = ipcRenderer.sendSync('config:getSync') || {};
} catch {}
contextBridge.exposeInMainWorld('bootConfig', bootConfig);

// app version (from package.json) — shown in the Settings footer
let appVersion = '';
try {
  appVersion = ipcRenderer.sendSync('app:getVersion') || '';
} catch {}
contextBridge.exposeInMainWorld('appVersion', appVersion);

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial) => ipcRenderer.invoke('config:set', partial),
  setResume: (folder, fileName) =>
    ipcRenderer.invoke('config:setResume', { folder, fileName }),
  openFolder: (title) => ipcRenderer.invoke('dialog:openFolder', title),
  listClips: (folder) => ipcRenderer.invoke('fs:listClips', folder),
  statClip: (filePath) => ipcRenderer.invoke('fs:statClip', filePath),
  copyClip: (src, destFolder) => ipcRenderer.invoke('fs:copyClip', { src, destFolder }),
  reveal: (folder) => ipcRenderer.invoke('fs:reveal', folder),
  showInFolder: (filePath) => ipcRenderer.invoke('fs:showInFolder', filePath),
  deleteClip: (filePath) => ipcRenderer.invoke('fs:deleteClip', filePath),
  getThumb: (clip) =>
    ipcRenderer.invoke('thumb:get', { path: clip.path, mtimeMs: clip.mtimeMs }),
  generateThumb: (clip) =>
    ipcRenderer.invoke('thumb:generate', { path: clip.path, mtimeMs: clip.mtimeMs }),
  onClipsChanged: (cb) => ipcRenderer.on('clips:changed', () => cb()),
  saveCutDialog: (defaultName) => ipcRenderer.invoke('dialog:saveCut', defaultName),
  exportCut: (opts) => ipcRenderer.invoke('clip:export', opts),
  getPreviewFile: () => ipcRenderer.invoke('preview:getFile'),
  onPreviewOpen: (cb) => ipcRenderer.on('preview:open', (e, clip) => cb(clip)),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  factoryReset: () => ipcRenderer.invoke('app:factoryReset'),
  registerFileTypes: () => ipcRenderer.invoke('assoc:register'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (e, info) => cb(info)),
  ytDownload: (url, format) => ipcRenderer.invoke('yt:download', { url, format }),
  onYtProgress: (cb) => ipcRenderer.on('yt:progress', (e, p) => cb(p)),
  readClipboard: () => ipcRenderer.invoke('clipboard:readText'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  // resolve the absolute path of a file dropped from Explorer (Electron removed File.path)
  getDroppedFilePath: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return (file && file.path) || '';
    }
  },
});
