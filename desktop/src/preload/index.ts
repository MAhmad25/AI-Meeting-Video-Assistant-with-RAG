import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { IpcChannels } from "../shared/ipc-channels";
import type { BackendStatus, BackendStatusEvent, ChatRequest, CreateMeetingJobRequest, CreateYoutubeJobRequest, DesktopSource, JobCreateResponse, JobProgressEvent, JobStatusResponse, RecordingAssistantState, Report, SaveRecordingRequest, SaveRecordingResponse, SavedReportDetail, SavedReportSummary } from "../shared/types";

function on<Args extends unknown[]>(channel: string, callback: (...args: Args) => void): () => void {
      const listener = (_event: IpcRendererEvent, ...args: Args) => callback(...args);
      ipcRenderer.on(channel, listener as never);
      return () => ipcRenderer.removeListener(channel, listener as never);
}

const api = {
      backend: {
            getStatus: (): Promise<BackendStatusEvent> => ipcRenderer.invoke(IpcChannels.BackendGetStatus),
            getBaseUrl: (): Promise<string> => ipcRenderer.invoke(IpcChannels.BackendGetBaseUrl),
            restart: (): Promise<BackendStatus> => ipcRenderer.invoke(IpcChannels.BackendRestart),
            onStatusChange: (cb: (event: BackendStatusEvent) => void) => on<[BackendStatusEvent]>(IpcChannels.BackendStatus, cb),
      },

      jobs: {
            createYoutubeJob: (payload: CreateYoutubeJobRequest): Promise<JobCreateResponse> => ipcRenderer.invoke(IpcChannels.YoutubeCreateJob, payload),
            createMeetingJob: (payload: CreateMeetingJobRequest): Promise<JobCreateResponse> => ipcRenderer.invoke(IpcChannels.MeetingCreateJob, payload),
            getStatus: (jobId: string): Promise<JobStatusResponse> => ipcRenderer.invoke(IpcChannels.JobGetStatus, jobId),
            getReport: (jobId: string): Promise<Report> => ipcRenderer.invoke(IpcChannels.JobGetReport, jobId),
            delete: (jobId: string): Promise<{ deleted: boolean }> => ipcRenderer.invoke(IpcChannels.JobDelete, jobId),
            subscribe: (jobId: string): Promise<void> => ipcRenderer.invoke(IpcChannels.JobSubscribe, jobId),
            unsubscribe: (jobId: string): Promise<void> => ipcRenderer.invoke(IpcChannels.JobUnsubscribe, jobId),
            onEvent: (cb: (payload: { jobId: string; event: JobProgressEvent }) => void) => on<[{ jobId: string; event: JobProgressEvent }]>(IpcChannels.JobEvent, cb),
            onStreamEnded: (cb: (payload: { jobId: string; reason: string }) => void) => on<[{ jobId: string; reason: string }]>(IpcChannels.JobStreamEnded, cb),
      },

      reports: {
            list: (): Promise<SavedReportSummary[]> => ipcRenderer.invoke(IpcChannels.ReportsList),
            get: (reportId: string): Promise<SavedReportDetail> => ipcRenderer.invoke(IpcChannels.ReportsGet, reportId),
      },

      chat: {
            ask: (payload: ChatRequest): Promise<string> => ipcRenderer.invoke(IpcChannels.ChatAsk, payload),
            cancel: (streamId: string): Promise<void> => ipcRenderer.invoke(IpcChannels.ChatCancel, streamId),
            onToken: (cb: (payload: { streamId: string; token: string }) => void) => on<[{ streamId: string; token: string }]>(IpcChannels.ChatToken, cb),
            onDone: (cb: (payload: { streamId: string }) => void) => on<[{ streamId: string }]>(IpcChannels.ChatDone, cb),
            onError: (cb: (payload: { streamId: string; error: string }) => void) => on<[{ streamId: string; error: string }]>(IpcChannels.ChatError, cb),
      },

      recording: {
            getSources: (): Promise<DesktopSource[]> => ipcRenderer.invoke(IpcChannels.RecordingGetSources),
            save: (payload: SaveRecordingRequest): Promise<SaveRecordingResponse> => ipcRenderer.invoke(IpcChannels.RecordingSave, payload),
            revealInFolder: (filePath: string): Promise<void> => ipcRenderer.invoke(IpcChannels.RecordingRevealInFolder, filePath),
      },

      window: {
            minimize: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowMinimize),
            maximizeToggle: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowMaximizeToggle),
            close: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowClose),
      },

      assistant: {
            setTrayState: (state: RecordingAssistantState): void => ipcRenderer.send(IpcChannels.TrayAssistantState, state),
            onStateChanged: (cb: (state: RecordingAssistantState) => void) => on<[RecordingAssistantState]>(IpcChannels.AssistantStateChanged, cb),
            onStartMeetingFromTray: (cb: () => void) => on<[]>(IpcChannels.StartMeetingFromTray, cb),
      },
};

contextBridge.exposeInMainWorld("api", api);

export type DesktopApi = typeof api;
