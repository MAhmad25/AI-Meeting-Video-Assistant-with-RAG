import { BrowserWindow, ipcMain } from "electron";
import log from "electron-log/main";
import { IpcChannels } from "../shared/ipc-channels";
import type { ChatRequest, CreateMeetingJobRequest, CreateYoutubeJobRequest, RecordingAssistantState, SaveRecordingRequest } from "../shared/types";
import { apiClient } from "./api-client";
import { backendManager } from "./backend-manager";
import { chatRelay } from "./chat-relay";
import { jobRelay } from "./job-relay";
import { getDesktopSources, revealInFolder, saveRecording } from "./recording";
import { setTrayAssistantState } from "./tray";
import { getMainWindow } from "./windows";

export function registerIpcHandlers(): void {
      // ---- Backend lifecycle ----
      ipcMain.handle(IpcChannels.BackendGetStatus, () => ({
            status: backendManager.getStatus(),
            baseUrl: backendManager.getBaseUrl(),
      }));
      ipcMain.handle(IpcChannels.BackendGetBaseUrl, () => backendManager.getBaseUrl());
      ipcMain.handle(IpcChannels.BackendRestart, async () => {
            await backendManager.restart();
            return backendManager.getStatus();
      });

      // ---- Job creation ----
      ipcMain.handle(IpcChannels.YoutubeCreateJob, async (_event, payload: CreateYoutubeJobRequest) => apiClient.createYoutubeJob(payload));

      ipcMain.handle(IpcChannels.MeetingCreateJob, async (_event, payload: CreateMeetingJobRequest) => apiClient.createMeetingJob(payload));

      ipcMain.handle(IpcChannels.JobGetStatus, async (_event, jobId: string) => apiClient.getJobStatus(jobId));

      ipcMain.handle(IpcChannels.JobGetReport, async (_event, jobId: string) => apiClient.getJobReport(jobId));

      ipcMain.handle(IpcChannels.JobDelete, async (_event, jobId: string) => {
            jobRelay.unsubscribe(jobId);
            return apiClient.deleteJob(jobId);
      });

      ipcMain.handle(IpcChannels.ReportsList, async () => apiClient.listReports());

      ipcMain.handle(IpcChannels.ReportsGet, async (_event, reportId: string) => apiClient.getSavedReport(reportId));

      // ---- Job progress streaming ----
      ipcMain.handle(IpcChannels.JobSubscribe, (event, jobId: string) => {
            jobRelay.subscribe(event.sender, jobId);
      });

      ipcMain.handle(IpcChannels.JobUnsubscribe, (_event, jobId: string) => {
            jobRelay.unsubscribe(jobId);
      });

      // ---- Chat / RAG ----
      ipcMain.handle(IpcChannels.ChatAsk, (event, payload: ChatRequest) => chatRelay.ask(event.sender, payload));

      ipcMain.handle(IpcChannels.ChatCancel, (_event, streamId: string) => {
            chatRelay.cancel(streamId);
      });

      // ---- Recording ----
      ipcMain.handle(IpcChannels.RecordingGetSources, () => getDesktopSources());

      ipcMain.handle(IpcChannels.RecordingSave, (_event, payload: SaveRecordingRequest) => saveRecording(payload));

      ipcMain.handle(IpcChannels.RecordingRevealInFolder, (_event, filePath: string) => {
            revealInFolder(filePath);
      });

      // ---- Window chrome (frameless window needs renderer-driven controls) ----
      ipcMain.handle(IpcChannels.WindowMinimize, (event) => {
            BrowserWindow.fromWebContents(event.sender)?.minimize();
      });

      ipcMain.handle(IpcChannels.WindowMaximizeToggle, (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) return;
            if (win.isMaximized()) win.unmaximize();
            else win.maximize();
      });

      ipcMain.handle(IpcChannels.WindowClose, (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) {
                  win.hide();
            }
      });

      // ---- Tray <-> renderer assistant state sync ----
      ipcMain.on(IpcChannels.TrayAssistantState, (_event, state: RecordingAssistantState) => {
            setTrayAssistantState(state);
            getMainWindow()?.webContents.send(IpcChannels.AssistantStateChanged, state);
      });

      log.info("[ipc] all handlers registered");
}
