const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    closeApp: () => ipcRenderer.send('window-close'),
    minimizeApp: () => ipcRenderer.send('window-minimize'),
    toggleFullscreen: () => ipcRenderer.send('window-toggle-fullscreen'),
    updateDynamicIsland: (data) => ipcRenderer.invoke('update-dynamic-island', data),
    onIslandAction: (callback) => ipcRenderer.on('island-action', (_event, action) => callback(action)),
    toggleDynamicIsland: (visible) => ipcRenderer.invoke('toggle-dynamic-island', visible),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
});

contextBridge.exposeInMainWorld('electronDL', {
    downloadFile: (url, filename) => ipcRenderer.send('download-req', { url, filename })
});
