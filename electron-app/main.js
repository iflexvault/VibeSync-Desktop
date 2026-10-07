const { app, BrowserWindow, dialog, ipcMain, screen, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { startBackend, stopBackend } = require('./backend-server');

const APP_ID = 'pro.iflexvault.vibesync.desktop';
const BACKEND_PORT = 38123;
const APP_PARTITION = 'persist:musicapp';
const RENDERER_CACHE_VERSION = 'vibesync-isolated-backend-3';
const LEGACY_USER_DATA_DIRS = ['Airbeats', 'airbeats'];
const LEGACY_MIGRATION_SKIP_NAMES = new Set([
    'Cache',
    'Cache_Data',
    'Code Cache',
    'GPUCache',
    'DawnCache',
    'Service Worker',
    'SingletonCookie',
    'SingletonLock',
    'SingletonSocket'
]);

let mainWindow;
let dynamicIslandWindow;
let serverProcess;
let serverUrl;

app.setAppUserModelId(APP_ID);
app.setName('VibeSync');

function migrateLegacyUserData(source, destination) {
    let entries;

    try {
        fs.mkdirSync(destination, { recursive: true });
        entries = fs.readdirSync(source, { withFileTypes: true });
    } catch (error) {
        console.warn('VibeSync could not inspect legacy user data:', error.code || error.message);
        return;
    }

    for (const entry of entries) {
        if (LEGACY_MIGRATION_SKIP_NAMES.has(entry.name)) continue;

        const sourcePath = path.join(source, entry.name);
        const destinationPath = path.join(destination, entry.name);

        try {
            if (entry.isDirectory()) {
                migrateLegacyUserData(sourcePath, destinationPath);
            } else if (entry.isFile() && !fs.existsSync(destinationPath)) {
                fs.copyFileSync(sourcePath, destinationPath);
            }
        } catch (error) {
            // Locked Chromium files should not prevent the application from opening.
            console.warn(`VibeSync skipped legacy data ${entry.name}:`, error.code || error.message);
        }
    }
}

function configureUserDataDirectory() {
    const appData = app.getPath('appData');
    const userData = path.join(appData, 'VibeSync');

    // Set the destination before migration so a partial migration is still usable.
    app.setPath('userData', userData);

    // Keep existing Airbeats local data available after the application ID and
    // product name change. Cache and locked session files are intentionally
    // skipped because they can be unreadable while the old app is running.
    if (!fs.existsSync(userData)) {
        for (const legacyName of LEGACY_USER_DATA_DIRS) {
            const legacyPath = path.join(appData, legacyName);
            if (fs.existsSync(legacyPath)) {
                migrateLegacyUserData(legacyPath, userData);
                break;
            }
        }
    }
}

configureUserDataDirectory();

async function refreshRendererCache() {
    const markerPath = path.join(app.getPath('userData'), '.vibesync-renderer-cache-version');

    try {
        if (fs.readFileSync(markerPath, 'utf8') === RENDERER_CACHE_VERSION) return;
    } catch {
        // The marker is created after the first successful cache refresh.
    }

    try {
        await session.fromPartition(APP_PARTITION).clearCache();
        fs.writeFileSync(markerPath, RENDERER_CACHE_VERSION, 'utf8');
    } catch (error) {
        console.warn('VibeSync could not refresh the renderer cache:', error.code || error.message);
    }
}

function getServerPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'server', 'server.exe');
    }

    return path.join(__dirname, '..', 'dist', 'server', 'server.exe');
}

async function startServer() {
    const serverPath = getServerPath();
    let executable;
    let args = [];
    if (fs.existsSync(serverPath)) {
        executable = serverPath;
    } else if (!app.isPackaged) {
        executable = process.platform === 'win32' ? 'python' : 'python3';
        args = [path.join(__dirname, '..', 'app.py')];
    } else {
        throw new Error(`VibeSync server executable was not found at ${serverPath}`);
    }

    const backend = await startBackend({ executable, args, version: app.getVersion(), port: BACKEND_PORT });
    serverProcess = backend.child;
    serverUrl = backend.url;
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
            partition: APP_PARTITION,
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
        if (new URL(url).origin !== serverUrl) {
            event.preventDefault();
            openExternalUrl(url);
        }
    });
    void mainWindow.loadURL(serverUrl);

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
    stopBackend(serverProcess);
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

app.whenReady().then(async () => {
    await refreshRendererCache();
    app.on('browser-window-created', (_event, window) => {
        window.setMenu(null);
        window.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
                event.preventDefault();
            }
        });
    });
    try {
        await startServer();
        createMainWindow();
        createDynamicIsland();
    } catch (error) {
        console.error('Failed to start VibeSync backend:', error);
        dialog.showErrorBox('VibeSync could not start', error.message);
        app.quit();
        return;
    }
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
