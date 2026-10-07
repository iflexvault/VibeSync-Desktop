const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    expandIsland: (focus) => ipcRenderer.invoke('island-expand', focus),
    shrinkIsland: () => ipcRenderer.invoke('island-shrink'),
    sendAction: (action) => ipcRenderer.send('island-action', action),
    onDoExpand: (callback) => ipcRenderer.on('do-expand', () => callback()),
    onDoShrink: (callback) => ipcRenderer.on('do-shrink', () => callback()),
    onTrackUpdated: (callback) => ipcRenderer.on('track-updated', (_event, data) => callback(data))
});
