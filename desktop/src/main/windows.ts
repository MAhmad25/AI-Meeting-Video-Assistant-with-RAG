import { BrowserWindow, session, shell } from "electron";
import path from "node:path";
import { IS_DEV } from "./constants";
import log from "electron-log/main";

let mainWindow: BrowserWindow | null = null;
let isAppQuitting = false;
let cspApplied = false;

export function getMainWindow(): BrowserWindow | null {
      return mainWindow;
}

export function setAppQuitting(): void {
      isAppQuitting = true;
}

/**
 * The renderer is now plain HTML/CSS/JS (desktop/renderer-vanilla), loaded
 * directly via loadFile — no Vite dev server, no build step, no bundler.
 * That means no injected inline scripts to accommodate, so CSP can be
 * strict unconditionally instead of branching by environment.
 */
function applyContentSecurityPolicy(): void {
      if (cspApplied) return;
      cspApplied = true;

      const csp = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "connect-src 'self' http://127.0.0.1:8756"].join("; ");

      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
            callback({
                  responseHeaders: {
                        ...details.responseHeaders,
                        "Content-Security-Policy": [csp],
                  },
            });
      });
}

export function createMainWindow(): BrowserWindow {
      applyContentSecurityPolicy();

      const win = new BrowserWindow({
            width: 1280,
            height: 840,
            minWidth: 960,
            minHeight: 640,
            icon: path.join(__dirname, "..", "..", "build", "icon.png"),
            show: false,
            backgroundColor: "#0000",
            titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
            titleBarOverlay: process.platform !== "darwin" ? { color: "#0000", symbolColor: "#0000", height: 40 } : undefined,
            webPreferences: {
                  preload: path.join(__dirname, "..", "preload", "index.js"),
                  contextIsolation: true,
                  nodeIntegration: false,
                  sandbox: false,
                  // Required so getUserMedia's chromeMediaSource desktop-audio
                  // constraint (used for meeting recording) is permitted at all.
                  webSecurity: true,
            },
      });

      win.once("ready-to-show", () => win.show());

      win.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: "deny" };
      });

      // desktop/renderer-vanilla is a sibling of dist/ (compiled from src/main),
      // so this resolves the same way whether running via `npm run dev` or
      // `npm start` — no dev/prod split needed since there's nothing to build.
      const rendererIndex = path.join(__dirname, "..", "..", "renderer-vanilla", "index.html");
      win.loadFile(rendererIndex).catch((err) => {
            log.error(`[window] Failed to load renderer at ${rendererIndex}`, err);
      });

      if (IS_DEV) win.webContents.openDevTools({ mode: "detach" });

      win.on("close", (event) => {
            if (!isAppQuitting) {
                  event.preventDefault();
                  win.hide();
            }
      });

      win.on("closed", () => {
            mainWindow = null;
      });

      mainWindow = win;
      return win;
}

export function showMainWindow(): void {
      if (!mainWindow) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
}
