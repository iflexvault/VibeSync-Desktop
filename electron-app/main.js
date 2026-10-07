const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');

const APP_ID = 'pro.iflexvault.vibesync.desktop';
const SERVER_URL = 'http://127.0.0.1:8000';
const LEGACY_USER_DATA_DIRS = ['Airbeats', 'airbeats'];

let mainWindow;
let dynamicIslandWindow;
let serverProcess;

app.setAppUserModelId(APP_ID);

function configureUserDataDirectory() {
    const appData = app.getPath('appData');
    const userData = path.join(appData, 'VibeSync');

    // Keep existing Airbeats local data available after the application ID and
    // product name change. The old directory is copied only when VibeSync has
    // not created its own directory yet.
    if (!fs.existsSync(userData)) {
        for (const legacyName of LEGACY_USER_DATA_DIRS) {
            const legacyPath = path.join(appData, legacyName);
            if (fs.existsSync(legacyPath)) {
                fs.cpSync(legacyPath, userData, { recursive: true, errorOnExist: false });
                break;
            }
        }
    }

    app.setPath('userData', userData);
}

configureUserDataDirectory();

function getServerPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'server', 'server.exe');
    }

    return path.join(__dirname, '..', 'dist', 'server', 'server.exe');
}

function startServer(onReady) {
    const serverPath = getServerPath();

    if (fs.existsSync(serverPath)) {
        serverProcess = spawn(serverPath, [], {
            windowsHide: true,
            stdio: 'ignore'
        });
    } else if (!app.isPackaged) {
        const python = process.platform === 'win32' ? 'python' : 'python3';
        serverProcess = spawn(python, [path.join(__dirname, '..', 'app.py')], {
            windowsHide: true,
            stdio: 'ignore'
        });
    } else {
        console.error(`VibeSync server executable was not found at ${serverPath}`);
        return;
    }

    serverProcess.on('error', (error) => {
        console.error('Failed to start VibeSync server:', error);
    });

    const waitForServer = () => {
        const request = http.get(SERVER_URL, (response) => {
            response.resume();
            if (response.statusCode === 200 || response.statusCode === 404) {
                onReady();
            } else {
                setTimeout(waitForServer, 200);
            }
        });

        request.on('error', () => setTimeout(waitForServer, 200));
    };

    waitForServer();
}

function getIconPath() {
    const iconPath = path.join(__dirname, 'build', 'vibesync.ico');
    return fs.existsSync(iconPath) ? iconPath : undefined;
}

function openExternalUrl(value) {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) return false;
        void shell.openExternal(url.toString());
        return true;
    } catch {
        return false;
    }
}

function createMainWindow() {
    const options = {
        fullscreen: true,
        autoHideMenuBar: true,
        title: 'VibeSync',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            partition: 'persist:musicapp',
            devTools: false
        }
    };

    const icon = getIconPath();
    if (icon) options.icon = icon;

    mainWindow = new BrowserWindow(options);
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        openExternalUrl(url);
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith(SERVER_URL)) {
            event.preventDefault();
            openExternalUrl(url);
        }
    });
    void mainWindow.loadURL(SERVER_URL);

    mainWindow.on('closed', () => {
        mainWindow = undefined;
        if (dynamicIslandWindow && !dynamicIslandWindow.isDestroyed()) {
            dynamicIslandWindow.close();
        }
    });
}

function setDynamicIslandBounds(expanded) {
    if (!dynamicIslandWindow || dynamicIslandWindow.isDestroyed()) return;

    const { width } = screen.getPrimaryDisplay().workAreaSize;
    const size = expanded ? { width: 450, height: 260 } : { width: 200, height: 100 };
    dynamicIslandWindow.setBounds({
        width: size.width,
        height: size.height,
        x: Math.round((width - size.width) / 2),
        y: 10
    });
    if (expanded) dynamicIslandWindow.webContents.send('do-expand');
}

function createDynamicIsland() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    dynamicIslandWindow = new BrowserWindow({
        width: 400,
        height: 120,
        x: Math.round((width - 400) / 2),
        y: 10,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        focusable: true,
        type: 'toolbar',
        show: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'dynamic-preload.js'),
            devTools: false
        }
    });

    dynamicIslandWindow.on('blur', () => {
        if (dynamicIslandWindow && !dynamicIslandWindow.isDestroyed()) {
            dynamicIslandWindow.webContents.send('do-shrink');
        }
    });
    dynamicIslandWindow.on('closed', () => {
        dynamicIslandWindow = undefined;
    });
    void dynamicIslandWindow.loadFile(path.join(__dirname, 'dynamic-island.html'));
}

function closeServer() {
    if (!serverProcess || serverProcess.killed) return;

    if (process.platform === 'win32' && serverProcess.pid) {
        execFile('taskkill', ['/pid', String(serverProcess.pid), '/T', '/F'], () => {});
    } else {
        serverProcess.kill('SIGTERM');
    }
    serverProcess = undefined;
}

ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-toggle-fullscreen', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.on('download-req', async (event, { url, filename }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;

    const { filePath } = await dialog.showSaveDialog(window, {
        defaultPath: filename,
        filters: [{ name: 'Audio', extensions: ['m4a'] }]
    });
    if (!filePath) return;

    window.webContents.session.once('will-download', (_downloadEvent, item) => {
        item.setSavePath(filePath);
    });
    window.webContents.downloadURL(url);
});
ipcMain.handle('open-external', (_event, url) => {
    return openExternalUrl(url);
});

ipcMain.handle('toggle-dynamic-island', (_event, visible) => {
    if (visible && (!dynamicIslandWindow || dynamicIslandWindow.isDestroyed())) {
        createDynamicIsland();
    } else if (!visible && dynamicIslandWindow && !dynamicIslandWindow.isDestroyed()) {
        dynamicIslandWindow.close();
    }
});

ipcMain.handle('island-expand', (_event, focus) => {
    setDynamicIslandBounds(true);
    if (focus && dynamicIslandWindow) dynamicIslandWindow.focus();
});
ipcMain.handle('island-shrink', () => {
    setTimeout(() => setDynamicIslandBounds(false), 400);
});
ipcMain.handle('update-dynamic-island', (_event, data) => {
    if (dynamicIslandWindow && !dynamicIslandWindow.isDestroyed()) {
        dynamicIslandWindow.webContents.send('track-updated', data);
    }
});
ipcMain.on('island-action', (_event, action) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('island-action', action);
    }
});

app.whenReady().then(() => {
    app.on('browser-window-created', (_event, window) => {
        window.setMenu(null);
        window.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
                event.preventDefault();
            }
        });
    });
    startServer(() => {
        createMainWindow();
        createDynamicIsland();
    });
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
            createDynamicIsland();
        }
    });
});

app.on('will-quit', closeServer);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
