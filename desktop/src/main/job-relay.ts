import type { WebContents } from "electron";
import log from "electron-log/main";
import { BACKEND_BASE_URL } from "./constants";
import { consumeSse } from "./sse-consumer";
import { IpcChannels } from "../shared/ipc-channels";
import type { JobProgressEvent } from "../shared/types";

/**
 * One JobRelay instance lives for the lifetime of the app and tracks all
 * active job-progress subscriptions so a renderer reload, or a second
 * subscribe call for the same job, never leaks a dangling fetch stream.
 */
export class JobRelay {
      private active = new Map<string, AbortController>();

      subscribe(webContents: WebContents, jobId: string): void {
            if (this.active.has(jobId)) {
                  log.debug(`[job-relay] already subscribed to job ${jobId}`);
                  return;
            }

            const controller = consumeSse<JobProgressEvent>(
                  `${BACKEND_BASE_URL}/jobs/${jobId}/events`,
                  { method: "GET" },
                  {
                        onMessage: (event) => {
                              if (webContents.isDestroyed()) return;
                              webContents.send(IpcChannels.JobEvent, { jobId, event });
                        },
                        onEnd: (reason, error) => {
                              this.active.delete(jobId);
                              if (webContents.isDestroyed()) return;
                              if (reason === "error") {
                                    log.error(`[job-relay] stream for job ${jobId} ended in error`, error);
                              }
                              webContents.send(IpcChannels.JobStreamEnded, { jobId, reason });
                        },
                  },
            );

            this.active.set(jobId, controller);
      }

      unsubscribe(jobId: string): void {
            this.active.get(jobId)?.abort();
            this.active.delete(jobId);
      }

      unsubscribeAll(): void {
            for (const controller of this.active.values()) controller.abort();
            this.active.clear();
      }
}

export const jobRelay = new JobRelay();
