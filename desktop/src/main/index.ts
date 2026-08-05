import { app, dialog } from "electron";
import log from "electron-log/main";
import { IpcChannels } from "../shared/ipc-channels";
import { backendManager } from "./backend-manager";
import { registerIpcHandlers } from "./ipc-handlers";
import { jobRelay } from "./job-relay";
import { registerDisplayMediaHandler } from "./media-handler";
import { installApplicationMenu } from "./menu";
import { createTray, destroyTray } from "./tray";
import { createMainWindow, getMainWindow, setAppQuitting } from "./windows";

log.initialize({ preload: true });
log.info("[app] starting", { version: app.getVersion(), platform: process.platform });

// Prevent uncaught errors from terminating the app — log and continue.
process.on("uncaughtException", (err) => {
      try {
            log.error("[uncaughtException]", err);
      } catch {
            /* swallow */
      }
});

process.on("unhandledRejection", (reason) => {
      try {
            log.error("[unhandledRejection]", reason as any);
      } catch {
            /* swallow */
      }
});

// Only one instance of the app — and one backend process — should ever run.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
      app.quit();
} else {
      app.on("second-instance", () => {
            const win = getMainWindow();
            if (win) {
                  if (win.isMinimized()) win.restore();
                  win.show();
                  win.focus();
            }
      });

      app.whenReady().then(bootstrap);

      app.on("window-all-closed", () => {
            // Keep the tray/backend alive on all platforms — this is a
            // menu-bar-resident meeting assistant, not a document window app.
            if (process.platform === "darwin") return;
      });

      app.on("activate", () => {
            if (!getMainWindow()) createMainWindow();
      });

      app.on("before-quit", async (event) => {
            setAppQuitting();
            if (backendManager.getStatus() === "stopped") return;
            event.preventDefault();
            jobRelay.unsubscribeAll();
            await backendManager.stop();
            destroyTray();
            app.exit(0);
      });
}

async function bootstrap(): Promise<void> {
      installApplicationMenu();
      registerDisplayMediaHandler();
      registerIpcHandlers();

      backendManager.onStatusChange((event) => {
            log.info(`[backend] status -> ${event.status}${event.message ? `: ${event.message}` : ""}`);
            getMainWindow()?.webContents.send(IpcChannels.BackendStatus, event);
      });

      const win = createMainWindow();
      createTray();

      try {
            await backendManager.start();
      } catch (err) {
            log.error("[app] backend failed to become healthy", err);
            dialog.showErrorBox("Backend failed to start", "The local AI backend could not be started. Check that Python 3 and the " + "backend virtualenv are set up correctly (see backend/README.md), then " + "restart the app.\n\n" + String((err as Error).message ?? err));
      }

      // Re-broadcast current status on every load (including Ctrl+R reload).
      // `.once` left the renderer stuck on "starting" after refresh because the
      // backend was already ready and never emitted another status change.
      win.webContents.on("did-finish-load", () => {
            win.webContents.send(IpcChannels.BackendStatus, {
                  status: backendManager.getStatus(),
                  baseUrl: backendManager.getBaseUrl(),
            });
      });
}
