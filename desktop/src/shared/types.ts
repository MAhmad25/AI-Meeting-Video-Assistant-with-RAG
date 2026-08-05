/**
 * Shared types mirroring backend/app/schemas/*.py.
 * Keep these in sync manually with the Python Pydantic models — there is no
 * codegen step, so any field added on the backend must be added here too.
 */

export type JobType = "youtube" | "meeting";
export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobCreateResponse {
  job_id: string;
  status: JobStatus;
}

export interface JobStatusResponse {
  job_id: string;
  type: JobType;
  status: JobStatus;
  stage: string;
  error: string | null;
  source_id: string | null;
  has_report: boolean;
}

/** One SSE message published by app/services/events.py::JobEventBus */
export interface JobProgressEvent {
  stage: string;
  message: string;
  ts: number;
}

// ---- Meeting report (backend/app/schemas/meeting.py) ----

export interface ActionItem {
  task: string;
  assignee: string | null;
  deadline: string | null;
}

export interface MeetingReport {
  title: string;
  executive_summary: string;
  meeting_purpose: string;
  discussion_topics: string[];
  key_decisions: string[];
  action_items: ActionItem[];
  open_questions: string[];
  risks_and_blockers: string[];
  deadlines: string[];
  follow_up_items: string[];
  key_takeaways: string[];
  next_meeting: string;
  keywords: string[];
  timeline: string[];
  final_conclusion: string;
}

// ---- YouTube report (backend/app/schemas/youtube.py) ----

export interface GlossaryItem {
  term: string;
  definition: string;
}

export interface YoutubeReport {
  title: string;
  overview: string;
  learning_objectives: string[];
  topics_covered: string[];
  step_by_step_explanation: string[];
  tools_mentioned: string[];
  important_concepts: string[];
  best_practices: string[];
  mistakes_to_avoid: string[];
  resources_mentioned: string[];
  key_takeaways: string[];
  glossary: GlossaryItem[];
  quiz_questions: string[];
  interview_questions: string[];
  final_summary: string;
}

export type Report = MeetingReport | YoutubeReport;

// ---- Saved reports (disk under storage/reports) ----

export type SavedReportType = "youtube" | "meeting";

export interface SavedReportSummary {
  id: string;
  name: string;
  date: string;
  summary: string;
  file_path: string;
  report_type: SavedReportType;
}

export interface SavedReportDetail extends SavedReportSummary {
  content: Report;
}

// ---- Requests ----

export interface CreateYoutubeJobRequest {
  url: string;
  title?: string;
}

export interface CreateMeetingJobRequest {
  recording_path: string;
  title?: string;
}

export interface ChatRequest {
  source_id: string;
  question: string;
}

export interface ChatToken {
  token?: string;
  error?: string;
  done?: boolean;
}

// ---- Backend process lifecycle (main process -> renderer) ----

export type BackendStatus =
  | "starting"
  | "ready"
  | "unreachable"
  | "crashed"
  | "stopped";

export interface BackendStatusEvent {
  status: BackendStatus;
  message?: string;
  baseUrl?: string;
}

// ---- Desktop recording ----

export interface DesktopSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  appIconDataUrl: string | null;
}

export interface SaveRecordingRequest {
  /** Raw bytes of the final audio/video container produced by MediaRecorder in the renderer. */
  buffer: ArrayBuffer;
  /** File extension without the dot, e.g. "webm". */
  extension: string;
  /** Suggested base file name, without extension. */
  suggestedName?: string;
}

export interface SaveRecordingResponse {
  /** Absolute path to the file saved under the user's Downloads folder. */
  path: string;
  fileName: string;
}

export type RecordingAssistantState =
  | "idle"
  | "listening"
  | "thinking"
  | "streaming"
  | "done"
  | "error";
