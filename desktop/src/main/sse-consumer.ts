/**
 * Consumes a `text/event-stream` response and invokes `onMessage` for every
 * `data: {...}` payload, JSON-parsed. Returns an AbortController the caller
 * can use to cancel the stream early (e.g. renderer unsubscribes, window
 * closes, or a new chat question supersedes an in-flight one).
 */
export interface SseHandlers<T> {
      onMessage: (data: T) => void;
      onEnd: (reason: "completed" | "aborted" | "error", error?: Error) => void;
}

export function consumeSse<T>(url: string, init: RequestInit, handlers: SseHandlers<T>): AbortController {
      const controller = new AbortController();

      (async () => {
            try {
                  const response = await fetch(url, { ...init, signal: controller.signal });
                  if (!response.ok || !response.body) {
                        throw new Error(`SSE request failed: ${response.status} ${response.statusText}`);
                  }

                  const reader = response.body.getReader();
                  const decoder = new TextDecoder("utf-8");
                  let buffer = "";

                  while (true) {
                        const { value, done } = await reader.read();
                        if (done) {
                              buffer += decoder.decode();
                              break;
                        }

                        buffer += decoder.decode(value, { stream: true });

                        // SSE frames are separated by a blank line.
                        let boundary = buffer.indexOf("\n\n");
                        while (boundary !== -1) {
                              const frame = buffer.slice(0, boundary);
                              buffer = buffer.slice(boundary + 2);

                              for (const line of frame.split("\n")) {
                                    if (line.startsWith("data:")) {
                                          const payload = line.slice(5).trim();
                                          if (payload) {
                                                try {
                                                      handlers.onMessage(JSON.parse(payload) as T);
                                                } catch {
                                                      // Non-JSON keep-alive/comment frame — ignore.
                                                }
                                          }
                                    }
                              }

                              boundary = buffer.indexOf("\n\n");
                        }
                  }

                  // Process any remaining frame content after the stream ends.
                  if (buffer.trim().length > 0) {
                        for (const line of buffer.split("\n")) {
                              if (line.startsWith("data:")) {
                                    const payload = line.slice(5).trim();
                                    if (payload) {
                                          try {
                                                handlers.onMessage(JSON.parse(payload) as T);
                                          } catch {
                                                // Non-JSON keep-alive/comment frame — ignore.
                                          }
                                    }
                              }
                        }
                  }

                  handlers.onEnd("completed");
            } catch (err) {
                  if (controller.signal.aborted) {
                        handlers.onEnd("aborted");
                  } else {
                        handlers.onEnd("error", err as Error);
                  }
            }
      })();

      return controller;
}
