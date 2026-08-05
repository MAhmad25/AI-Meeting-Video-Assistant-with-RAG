import type { WebContents } from "electron";
import { randomUUID } from "node:crypto";
import log from "electron-log/main";
import { BACKEND_BASE_URL } from "./constants";
import { consumeSse } from "./sse-consumer";
import { IpcChannels } from "../shared/ipc-channels";
import type { ChatRequest, ChatToken } from "../shared/types";

export class ChatRelay {
      private active = new Map<string, AbortController>();

      ask(webContents: WebContents, payload: ChatRequest): string {
            const streamId = randomUUID();
            let finished = false;

            const controller = consumeSse<ChatToken>(
                  `${BACKEND_BASE_URL}/chat`,
                  {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                  },
                  {
                        onMessage: (event) => {
                              if (webContents.isDestroyed()) return;
                              if (event.error) {
                                    finished = true;
                                    webContents.send(IpcChannels.ChatError, { streamId, error: event.error });
                                    return;
                              }
                              if (event.token) {
                                    webContents.send(IpcChannels.ChatToken, { streamId, token: event.token });
                              }
                              if (event.done) {
                                    finished = true;
                                    webContents.send(IpcChannels.ChatDone, { streamId });
                              }
                        },
                        onEnd: (reason, error) => {
                              this.active.delete(streamId);
                              if (webContents.isDestroyed()) return;
                              if (reason === "error") {
                                    log.error(`[chat-relay] stream ${streamId} ended in error`, error);
                                    if (!finished) {
                                          finished = true;
                                          webContents.send(IpcChannels.ChatError, {
                                                streamId,
                                                error: error?.message ?? "Chat stream failed",
                                          });
                                    }
                              } else if (reason === "completed" && !finished) {
                                    // Guarantee unlock even if the backend omitted the done frame.
                                    finished = true;
                                    webContents.send(IpcChannels.ChatDone, { streamId });
                              }
                        },
                  },
            );

            this.active.set(streamId, controller);
            return streamId;
      }

      cancel(streamId: string): void {
            this.active.get(streamId)?.abort();
            this.active.delete(streamId);
      }
}

export const chatRelay = new ChatRelay();
