import { Menu, Tray, app, nativeImage } from "electron";
import path from "node:path";
import { IpcChannels } from "../shared/ipc-channels";
import type { RecordingAssistantState } from "../shared/types";
import { getMainWindow, showMainWindow } from "./windows";

let tray: Tray | null = null;

const STATE_LABEL: Record<RecordingAssistantState, string> = {
      idle: "AI Meeting Assistant — idle",
      listening: "AI Meeting Assistant — listening…",
      thinking: "AI Meeting Assistant — thinking…",
      streaming: "AI Meeting Assistant — writing report…",
      done: "AI Meeting Assistant — report ready",
      error: "AI Meeting Assistant — something went wrong",
};

function trayIconPath(): string {
      // A template image on macOS auto-adapts to light/dark menu bars.
      const file = process.platform === "darwin" ? "icon.png" : "icon.png";
      return path.join(__dirname, "..", "..", "build", file);
}

export function createTray(): Tray {
      const icon = nativeImage.createFromPath(trayIconPath());
      tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
      if (process.platform === "darwin") tray.setImage(icon.resize({ width: 18, height: 18 }));

      tray.setToolTip(STATE_LABEL.idle);
      tray.setContextMenu(buildMenu());

      tray.on("click", () => showMainWindow());

      return tray;
}

function buildMenu(): Menu {
      return Menu.buildFromTemplate([
            { label: "Open AI Meeting Assistant", click: () => showMainWindow() },
            { type: "separator" },
            {
                  label: "Start Meeting Recording",
                  click: () => {
                        showMainWindow();
                        getMainWindow()?.webContents.send(IpcChannels.StartMeetingFromTray);
                  },
            },
            { type: "separator" },
            { label: "Quit", role: "quit" },
      ]);
}

export function setTrayAssistantState(state: RecordingAssistantState): void {
      if (!tray) return;
      tray.setToolTip(STATE_LABEL[state]);
}

export function destroyTray(): void {
      tray?.destroy();
      tray = null;
}
