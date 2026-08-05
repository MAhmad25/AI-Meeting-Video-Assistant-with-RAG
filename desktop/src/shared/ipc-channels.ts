/**
 * Every IPC channel used between the main process and the renderer is
 * declared here exactly once. Both src/main/ipc-handlers.ts (handle side)
 * and src/preload/index.ts (invoke/send side) import from this file so a
 * typo can never silently create a dead channel.
 */
export const IpcChannels = {
  // Backend process lifecycle
  BackendStatus: "backend:status", // main -> renderer (event, on)
  BackendGetStatus: "backend:get-status", // renderer -> main (invoke)
  BackendGetBaseUrl: "backend:get-base-url", // renderer -> main (invoke)
  BackendRestart: "backend:restart", // renderer -> main (invoke)

  // Job lifecycle (YouTube + Meeting share the same job model server-side)
  YoutubeCreateJob: "youtube:create-job", // invoke
  MeetingCreateJob: "meeting:create-job", // invoke
  JobGetStatus: "job:get-status", // invoke
  JobGetReport: "job:get-report", // invoke
  JobDelete: "job:delete", // invoke
  JobSubscribe: "job:subscribe", // invoke -> starts SSE relay
  JobUnsubscribe: "job:unsubscribe", // invoke -> stops SSE relay
  JobEvent: "job:event", // main -> renderer (event, on) payload: { jobId, event: JobProgressEvent }
  JobStreamEnded: "job:stream-ended", // main -> renderer (event, on) payload: { jobId, reason }

  // Saved reports on disk
  ReportsList: "reports:list", // invoke
  ReportsGet: "reports:get", // invoke

  // Chat / RAG
  ChatAsk: "chat:ask", // invoke -> starts streaming, resolves with a streamId
  ChatCancel: "chat:cancel", // invoke
  ChatToken: "chat:token", // main -> renderer (event, on) payload: { streamId, token }
  ChatDone: "chat:done", // main -> renderer (event, on) payload: { streamId }
  ChatError: "chat:error", // main -> renderer (event, on) payload: { streamId, error }

  // Desktop capture / recording
  RecordingGetSources: "recording:get-sources", // invoke
  RecordingSave: "recording:save", // invoke
  RecordingRevealInFolder: "recording:reveal-in-folder", // invoke

  // Window / tray / app chrome
  WindowMinimize: "window:minimize", // invoke
  WindowMaximizeToggle: "window:maximize-toggle", // invoke
  WindowClose: "window:close", // invoke
  WindowShow: "window:show", // invoke
  TrayAssistantState: "tray:assistant-state", // renderer -> main (send)
  AssistantStateChanged: "assistant:state-changed", // main -> renderer (event, on)
  StartMeetingFromTray: "tray:start-meeting", // main -> renderer (event, on)
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
