import { app, desktopCapturer, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import log from "electron-log/main";
import type { DesktopSource, SaveRecordingRequest, SaveRecordingResponse } from "../shared/types";

/**
 * Lists capturable screens/windows so the renderer can build a
 * getUserMedia({ video: false, audio: { mandatory: { chromeMediaSource:
 * 'desktop', chromeMediaSourceId: source.id } } }) constraint for system
 * audio capture. Electron only exposes system-audio loopback through the
 * desktopCapturer + chromeMediaSource bridge, which is why this listing has
 * to happen in the main process and be handed to the renderer via IPC
 * rather than being something the renderer can query itself.
 */
export async function getDesktopSources(): Promise<DesktopSource[]> {
      const sources = await desktopCapturer.getSources({
            types: ["screen", "window"],
            thumbnailSize: { width: 320, height: 180 },
            fetchWindowIcons: true,
      });

      return sources.map((source) => ({
            id: source.id,
            name: source.name,
            thumbnailDataUrl: source.thumbnail.toDataURL(),
            appIconDataUrl: source.appIcon ? source.appIcon.toDataURL() : null,
      }));
}

function sanitizeFileName(name: string): string {
      return name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "recording";
}

function downloadsDir(): string {
      return app.getPath("videos");
}

/**
 * Persists the recording produced by the renderer's MediaRecorder to disk
 * under ~/Downloads, per the "Save recordings automatically inside the
 * user's Downloads folder" requirement. The returned absolute path is what
 * gets POSTed to /meeting/jobs as `recording_path` for the backend pipeline
 * to pick up.
 */
export async function saveRecording(req: SaveRecordingRequest): Promise<SaveRecordingResponse> {
      const dir = path.join(downloadsDir(), "Recordings");
      await fs.mkdir(dir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const base = sanitizeFileName(req.suggestedName ?? `Meeting Recording ${timestamp}`);
      const fileName = `${base}.${req.extension}`;
      const fullPath = path.join(dir, fileName);

      await fs.writeFile(fullPath, Buffer.from(req.buffer));
      log.info(`[recording] saved ${req.buffer.byteLength} bytes to ${fullPath}`);

      return { path: fullPath, fileName };
}

export function revealInFolder(filePath: string): void {
      shell.showItemInFolder(filePath);
}
