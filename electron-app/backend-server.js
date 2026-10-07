const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile, spawn } = require('node:child_process');

const APP_ID = 'pro.iflexvault.vibesync.desktop';
const RENDERER_URL = 'http://127.0.0.1:8000';

function stopBackend(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null || child.killed) return;
    if (process.platform === 'win32' && child.pid) {
        execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
    } else {
        child.kill('SIGTERM');
    }
}

function checkBackendIdentity(url, instanceId, version) {
    return new Promise((resolve) => {
        const request = http.get(`${url}/api/desktop/health`, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                body += chunk;
                if (body.length > 4096) request.destroy();
            });
            response.on('error', () => resolve(false));
            response.on('end', () => {
                try {
                    const identity = JSON.parse(body);
                    resolve(response.statusCode === 200 && identity.appId === APP_ID &&
                        identity.instanceId === instanceId && identity.version === version);
                } catch {
                    resolve(false);
                }
            });
        });
        request.setTimeout(1000, () => request.destroy());
        request.on('error', () => resolve(false));
    });
}

function startBackend({ executable, args = [], version, port = 38123, env = process.env, timeoutMs = 60000 }) {
    return new Promise((resolve, reject) => {
        const startupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibesync-backend-'));
        const startupFile = path.join(startupDir, 'ready.json');
        const instanceId = randomUUID();
        const child = spawn(executable, args, {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...env,
                VIBESYNC_INSTANCE_ID: instanceId,
                VIBESYNC_VERSION: version,
                VIBESYNC_PORT: String(port),
                VIBESYNC_STARTUP_FILE: startupFile
            }
        });
        let settled = false;
        let retry;
        let diagnostics = '';
        const recordOutput = (chunk) => {
            diagnostics = (diagnostics + chunk.toString()).slice(-4096);
        };
        child.stdout.on('data', recordOutput);
        child.stderr.on('data', recordOutput);

        const cleanup = () => {
            clearTimeout(deadline);
            clearTimeout(retry);
            child.removeListener('error', onError);
            child.removeListener('exit', onExit);
            try {
                fs.rmSync(startupDir, { recursive: true, force: true });
            } catch {
                // Temporary-file cleanup must not affect launch.
            }
        };
        const fail = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            stopBackend(child);
            reject(error);
        };
        const onError = (error) => fail(new Error(`Could not start the VibeSync backend: ${error.message}`));
        const onExit = (code, signal) => fail(new Error(
            `The VibeSync backend exited before becoming ready (${signal || code}).\n${diagnostics}`
        ));
        const deadline = setTimeout(() => fail(new Error(
            `The VibeSync backend did not become ready within ${timeoutMs / 1000} seconds.\n${diagnostics}`
        )), timeoutMs);
        child.once('error', onError);
        child.once('exit', onExit);

        const waitForBackend = async () => {
            let announcement;
            try {
                announcement = JSON.parse(fs.readFileSync(startupFile, 'utf8'));
            } catch {
                // The backend announces its port only after its own socket is bound.
            }
            if (announcement?.appId === APP_ID && announcement.instanceId === instanceId &&
                Number.isInteger(announcement.port) && announcement.port > 0 && announcement.port <= 65535) {
                const url = `http://127.0.0.1:${announcement.port}`;
                if (await checkBackendIdentity(url, instanceId, version)) {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    resolve({ child, url });
                    return;
                }
            }
            if (!settled) retry = setTimeout(waitForBackend, 100);
        };
        void waitForBackend();
    });
}

module.exports = { startBackend, stopBackend, RENDERER_URL };
