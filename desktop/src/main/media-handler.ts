import { desktopCapturer, session } from "electron";
import log from "electron-log/main";

/**
 * Electron's renderer-side `navigator.mediaDevices.getDisplayMedia({ audio:
 * true, video: true })` is routed through this main-process handler, which
 * is the only place system-audio loopback capture can be authorized from
 * (see https://www.electronjs.org/docs/latest/api/session#sessetdisplaymediarequesthandlerhandler-opts).
 *
 * We request video too because Chromium's loopback-audio implementation is
 * tied to a screen/window capture source, but the renderer's
 * MeetingRecorder immediately discards the video track and only persists
 * the audio track — see src/renderer (Phase 5).
 */
export function registerDisplayMediaHandler(): void {
      session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
            try {
                  const sources = await desktopCapturer.getSources({ types: ["screen"] });
                  const primary = sources[0];
                  if (!primary) {
                        log.error("[media-handler] no capturable screen sources found");
                        callback({});
                        return;
                  }
                  callback({ video: primary, audio: "loopback" });
            } catch (err) {
                  log.error("[media-handler] failed to resolve display media request", err);
                  callback({});
            }
      });
}
