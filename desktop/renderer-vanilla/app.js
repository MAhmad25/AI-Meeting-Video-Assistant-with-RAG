"use strict";

const $ = (id) => document.getElementById(id);

/* ============================================================
   lib/format.js
   ============================================================ */
function formatStage(stage) {
      return stage
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
}

function formatElapsed(startMs, nowMs) {
      const totalSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/* ============================================================
   lib/pipeline-stages.js
   ============================================================ */
const YOUTUBE_STAGES = [
      { id: "initializing", label: "Initializing" },
      { id: "downloading_video", label: "Downloading Video" },
      { id: "compressing_audio", label: "Compressing Audio" },
      { id: "generating_transcript", label: "Generating Transcript" },
      { id: "chunking", label: "Chunking" },
      { id: "reader_agent", label: "Map Chain Chunk Analysis" },
      { id: "critic_agent", label: "Map Chain Summary" },
      { id: "saving_report", label: "Saving Report" },
      { id: "indexing", label: "Indexing" },
      { id: "finished", label: "Finished" },
];

const MEETING_STAGES = [
      { id: "initializing", label: "Initializing" },
      { id: "compressing_audio", label: "Compressing Audio" },
      { id: "generating_transcript", label: "Generating Transcript" },
      { id: "chunking", label: "Chunking" },
      { id: "reader_agent", label: "Reader Agent" },
      { id: "critic_agent", label: "Critic Agent" },
      { id: "saving_report", label: "Saving Report" },
      { id: "indexing", label: "Indexing" },
      { id: "finished", label: "Finished" },
];

function stagesFor(jobType) {
      return jobType === "youtube" ? YOUTUBE_STAGES : MEETING_STAGES;
}

function baseStageId(stage) {
      if (!stage) return "";
      return stage.endsWith("_done") ? stage.slice(0, -"_done".length) : stage;
}

/* ============================================================
   Backend status
   ============================================================ */
const backendState = { status: "starting", message: undefined, baseUrl: undefined };

function renderBackendStatus() {
      const dot = $("backend-dot");
      const label = $("backend-label");
      dot.className = "status-dot " + (backendState.status === "ready" ? "status-dot--ready" : backendState.status === "starting" ? "status-dot--starting" : "status-dot--bad");
      label.textContent = backendState.status;

      const notice = $("backend-notice");
      if (backendState.status === "ready") {
            notice.classList.add("hidden");
      } else {
            notice.classList.remove("hidden");
            notice.textContent = `Backend ${backendState.status}${backendState.message ? " — " + backendState.message : "…"}`;
      }
      renderIdleCards();
}

function applyBackendStatus(event) {
      Object.assign(backendState, event);
      renderBackendStatus();
      if (event.status === "ready") void refreshSavedReports();
}

window.api.backend.onStatusChange((event) => {
      applyBackendStatus(event);
});
window.api.backend.getBaseUrl().then((baseUrl) => {
      backendState.baseUrl = baseUrl;
});

/* ============================================================
   Sidebar toggle / collapse
   ============================================================ */
const SIDEBAR_STATE_KEY = "sidebar-collapsed";

function initSidebarToggle() {
      const rightRail = $("right-rail");
      const sidebarToggle = $("sidebar-toggle");

      // Restore sidebar state from localStorage
      const isCollapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === "true";
      if (isCollapsed) {
            rightRail.classList.add("collapsed");
      }

      // Handle toggle button click
      sidebarToggle.addEventListener("click", () => {
            rightRail.classList.toggle("collapsed");
            const newState = rightRail.classList.contains("collapsed");
            localStorage.setItem(SIDEBAR_STATE_KEY, String(newState));
      });

      // Optional: Allow keyboard shortcut (Alt + Shift + S)
      document.addEventListener("keydown", (e) => {
            if (e.altKey && e.shiftKey && e.code === "KeyS") {
                  e.preventDefault();
                  sidebarToggle.click();
            }
      });
}

// Initialize sidebar toggle when DOM is ready
if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initSidebarToggle);
} else {
      initSidebarToggle();
}

/* ============================================================
   Mode switcher
   ============================================================ */
let mode = "youtube"; // "youtube" | "meeting"

function setMode(next) {
      mode = next;
      document.querySelectorAll(".mode-btn").forEach((btn) => {
            btn.classList.toggle("mode-btn--active", btn.dataset.mode === mode);
      });
      renderIdleCards();
}

document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
            if (btn.disabled) return;
            setMode(btn.dataset.mode);
      });
});

function setModeSwitcherDisabled(disabled) {
      document.querySelectorAll(".mode-btn").forEach((btn) => (btn.disabled = disabled));
}

/* ============================================================
   Job state machine (mirrors hooks/useJob.ts)
   ============================================================ */
const INITIAL_JOB_STATE = {
      phase: "idle", // idle | creating | running | completed | failed
      jobId: null,
      jobType: null,
      events: [],
      currentStage: null,
      error: null,
      report: null,
      reportDate: null,
};
let job = { ...INITIAL_JOB_STATE };
let activeJobId = null;

function setJob(patch) {
      job = { ...job, ...(typeof patch === "function" ? patch(job) : patch) };
      renderAll();
}

async function finalizeJob(jobId) {
      try {
            const report = await window.api.jobs.getReport(jobId);
            if (job.jobId === jobId) setJob({ phase: "completed", report });
            void refreshSavedReports();
      } catch (err) {
            if (job.jobId === jobId) setJob({ phase: "failed", error: String(err.message || err) });
      }
}

window.api.jobs.onEvent(({ jobId, event }) => {
      if (jobId !== activeJobId) return;
      if (!event || typeof event.stage !== "string") return; // drop malformed/keepalive-shaped events

      setJob((prev) => ({
            phase: event.stage === "error" ? "failed" : "running",
            currentStage: event.stage,
            error: event.stage === "error" ? event.message : prev.error,
            events: [...prev.events, event],
      }));

      if (event.stage === "finished") void finalizeJob(jobId);
});

window.api.jobs.onStreamEnded(({ jobId, reason }) => {
      if (jobId !== activeJobId || reason !== "error") return;
      if (job.phase !== "completed") setJob({ phase: "failed", error: "Lost connection to the backend" });
});

async function startYoutubeJob(url) {
      resetJob();
      setJob({ phase: "creating", jobType: "youtube" });
      const { job_id } = await window.api.jobs.createYoutubeJob({ url });
      activeJobId = job_id;
      setJob({ jobId: job_id, phase: "running" });
      await window.api.jobs.subscribe(job_id);
}

async function startMeetingJob(recordingPath) {
      resetJob();
      setJob({ phase: "creating", jobType: "meeting" });
      const { job_id } = await window.api.jobs.createMeetingJob({ recording_path: recordingPath });
      activeJobId = job_id;
      setJob({ jobId: job_id, phase: "running" });
      await window.api.jobs.subscribe(job_id);
}

function resetJob() {
      if (activeJobId) void window.api.jobs.unsubscribe(activeJobId);
      activeJobId = null;
      job = { ...INITIAL_JOB_STATE };
}

/* ============================================================
   Recorder (mirrors hooks/useMeetingRecorder.ts)
   ============================================================ */
const recorder = { status: "idle", level: 0, elapsedMs: 0, error: null };
let mediaStreamRef = null;
let audioOnlyStreamRef = null;
let mediaRecorderRef = null;
let recordedChunks = [];
let audioCtxRef = null;
let rafRef = null;
let startedAtRef = 0;
let recorderTimerRef = null;

function setRecorder(patch) {
      Object.assign(recorder, patch);
      renderRecordingPanel();
}

function stopLevelMeter() {
      if (rafRef) cancelAnimationFrame(rafRef);
      rafRef = null;
      if (audioCtxRef) audioCtxRef.close().catch(() => {});
      audioCtxRef = null;
}

function startLevelMeter(stream) {
      const ctx = new AudioContext();
      audioCtxRef = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
            analyser.getByteTimeDomainData(data);
            let sumSquares = 0;
            for (let i = 0; i < data.length; i++) {
                  const normalized = (data[i] - 128) / 128;
                  sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / data.length);
            setRecorder({ level: Math.min(1, rms * 4) });
            rafRef = requestAnimationFrame(tick);
      };
      rafRef = requestAnimationFrame(tick);
}

function cleanupRecorderStreams() {
      stopLevelMeter();
      if (recorderTimerRef) clearInterval(recorderTimerRef);
      recorderTimerRef = null;
      audioOnlyStreamRef?.getTracks().forEach((t) => t.stop());
      mediaStreamRef?.getTracks().forEach((t) => t.stop());
      audioOnlyStreamRef = null;
      mediaStreamRef = null;
      mediaRecorderRef = null;
}

async function recorderStart() {
      setRecorder({ error: null, status: "starting" });
      try {
            // Resolved without a picker by session.setDisplayMediaRequestHandler in
            // the main process (src/main/media-handler.ts).
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
            mediaStreamRef = displayStream;

            const audioTracks = displayStream.getAudioTracks();
            if (audioTracks.length === 0) {
                  throw new Error("No system audio track was captured. Some platforms require screen recording / audio permissions to be granted to this app first.");
            }

            const audioOnly = new MediaStream(audioTracks);
            audioOnlyStreamRef = audioOnly;
            displayStream.getVideoTracks().forEach((t) => t.stop());

            const mediaRecorder = new MediaRecorder(audioOnly, { mimeType: "audio/webm;codecs=opus" });
            recordedChunks = [];
            mediaRecorder.ondataavailable = (e) => {
                  if (e.data.size > 0) recordedChunks.push(e.data);
            };
            mediaRecorderRef = mediaRecorder;
            mediaRecorder.start(1000);

            startLevelMeter(audioOnly);
            startedAtRef = Date.now();
            recorderTimerRef = setInterval(() => setRecorder({ elapsedMs: Date.now() - startedAtRef }), 250);

            setRecorder({ status: "recording" });
      } catch (err) {
            setRecorder({ error: err.message, status: "error" });
            cleanupRecorderStreams();
      }
}

async function recorderStop() {
      const mediaRecorder = mediaRecorderRef;
      if (!mediaRecorder || recorder.status !== "recording") return null;

      setRecorder({ status: "stopping" });
      const stopped = new Promise((resolve) => {
            mediaRecorder.onstop = () => resolve();
      });
      mediaRecorder.stop();
      await stopped;
      cleanupRecorderStreams();

      const blob = new Blob(recordedChunks, { type: "audio/webm" });
      const buffer = await blob.arrayBuffer();

      try {
            const saved = await window.api.recording.save({ buffer, extension: "webm" });
            setRecorder({ status: "idle", level: 0, elapsedMs: 0 });
            return saved;
      } catch (err) {
            setRecorder({ error: err.message, status: "error" });
            return null;
      }
}

function recorderDiscard() {
      mediaRecorderRef?.stop();
      cleanupRecorderStreams();
      setRecorder({ status: "idle", level: 0, elapsedMs: 0 });
      recordedChunks = [];
}

/* ============================================================
   Chat (mirrors hooks/useChat.ts)
   ============================================================ */
let chatMessages = [];
let chatIsStreaming = false;
let chatStreamId = null;
let chatAssistantMsgId = null;
let chatSourceId = null;

function uuid() {
      return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

window.api.chat.onToken(({ streamId, token }) => {
      if (!chatIsStreaming || !chatAssistantMsgId) return;
      if (chatStreamId && streamId !== chatStreamId) return;
      if (!chatStreamId) chatStreamId = streamId;
      const msg = chatMessages.find((m) => m.id === chatAssistantMsgId);
      if (msg) msg.content += token;
      renderChatMessages();
});

window.api.chat.onDone(({ streamId }) => {
      if (!chatIsStreaming || !chatAssistantMsgId) return;
      if (chatStreamId && streamId !== chatStreamId) return;
      const msg = chatMessages.find((m) => m.id === chatAssistantMsgId);
      if (msg) msg.streaming = false;
      chatIsStreaming = false;
      chatStreamId = null;
      chatAssistantMsgId = null;
      renderChatMessages();
      renderChatInputState();
      renderAssistantState();
});

window.api.chat.onError(({ streamId, error }) => {
      if (!chatIsStreaming || !chatAssistantMsgId) return;
      if (chatStreamId && streamId !== chatStreamId) return;
      const msg = chatMessages.find((m) => m.id === chatAssistantMsgId);
      if (msg) {
            msg.streaming = false;
            msg.error = error;
      }
      chatIsStreaming = false;
      chatStreamId = null;
      chatAssistantMsgId = null;
      renderChatMessages();
      renderChatInputState();
      renderAssistantState();
});

async function chatAsk(question) {
      if (!chatSourceId || !question.trim() || chatIsStreaming) return;
      const userMsg = { id: uuid(), role: "user", content: question, streaming: false };
      const assistantMsg = { id: uuid(), role: "assistant", content: "", streaming: true };
      chatAssistantMsgId = assistantMsg.id;
      chatMessages = [...chatMessages, userMsg, assistantMsg];
      chatIsStreaming = true;
      renderChatMessages();
      renderChatInputState();
      renderAssistantState();

      try {
            const streamId = await window.api.chat.ask({ source_id: chatSourceId, question });
            chatStreamId = streamId;
      } catch (err) {
            const msg = chatMessages.find((m) => m.id === chatAssistantMsgId);
            if (msg) {
                  msg.streaming = false;
                  msg.error = err?.message || String(err);
            }
            chatIsStreaming = false;
            chatStreamId = null;
            chatAssistantMsgId = null;
            renderChatMessages();
            renderChatInputState();
            renderAssistantState();
      }
}

/* ============================================================
   Assistant state (mirrors hooks/useAssistantState.ts) + orb
   ============================================================ */
function deriveAssistantState() {
      if (job.phase === "failed" || recorder.status === "error") return "error";
      if (recorder.status === "recording" || recorder.status === "starting") return "listening";
      if (job.phase === "creating" || job.phase === "running") return "thinking";
      if (chatIsStreaming) return "streaming";
      if (job.phase === "completed") return "done";
      return "idle";
}

let lastAssistantState = null;
function renderAssistantState() {
      const state = deriveAssistantState();
      $("orb").className = `wheel-and-hamster orb--${state}`;
      $("orb-state-label").textContent = state;
      if (state !== lastAssistantState) {
            window.api.assistant.setTrayState(state);
            lastAssistantState = state;
      }
}

window.api.assistant.onStartMeetingFromTray(() => setMode("meeting"));

/* ============================================================
   Thinking panel (mirrors components/pipeline/ThinkingPanel.tsx)
   ============================================================ */
let thinkingManualExpanded = null; // null = auto

function findLatestMessage(events, baseId) {
      for (let i = events.length - 1; i >= 0; i--) {
            if (baseStageId(events[i].stage) === baseId && events[i].message) return events[i].message;
      }
      return null;
}

function renderThinkingPanel() {
      const card = $("thinking-card");
      const container = $("thinking-panel");

      if (!job.jobType || job.phase === "idle" || (job.phase === "completed" && job.events.length === 0)) {
            card.classList.add("hidden");
            container.innerHTML = "";
            return;
      }
      card.classList.remove("hidden");

      const stages = stagesFor(job.jobType);
      const failed = job.phase === "failed";
      const isFinished = job.currentStage === "finished" || failed;
      const autoExpanded = job.events.length > 0 && !isFinished;
      const expanded = thinkingManualExpanded ?? (autoExpanded || isFinished);

      const reachedIndex = job.currentStage ? stages.findIndex((s) => s.id === baseStageId(job.currentStage)) : -1;
      const currentIsDoneEvent = (job.currentStage && job.currentStage.endsWith("_done")) || job.currentStage === "finished";

      let elapsedSeconds = null;
      if (job.events.length > 1) {
            elapsedSeconds = Math.max(1, Math.round(job.events[job.events.length - 1].ts - job.events[0].ts));
      }

      container.innerHTML = "";

      // Toggle header
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "thinking-toggle";
      toggle.setAttribute("aria-expanded", String(expanded));

      const diamond = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      diamond.setAttribute("width", "16");
      diamond.setAttribute("height", "16");
      diamond.setAttribute("viewBox", "0 0 24 24");
      diamond.setAttribute("fill", failed ? "var(--danger)" : !isFinished ? "var(--warn)" : "var(--signal)");
      diamond.innerHTML = '<path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"></path>';
      toggle.appendChild(diamond);

      const labelSpan = document.createElement("span");
      if (!isFinished) {
            labelSpan.className = "thinking-label thinking-label--active";
            labelSpan.textContent = "Thinking";
      } else {
            labelSpan.className = "thinking-label " + (failed ? "thinking-label--danger" : "thinking-label--muted");
            labelSpan.textContent = failed ? "Something went wrong" : elapsedSeconds ? `Thought for ${elapsedSeconds} second${elapsedSeconds === 1 ? "" : "s"}` : "Done thinking";
      }
      toggle.appendChild(labelSpan);

      const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      chevron.setAttribute("width", "14");
      chevron.setAttribute("height", "14");
      chevron.setAttribute("viewBox", "0 0 24 24");
      chevron.setAttribute("fill", "none");
      chevron.setAttribute("stroke", "var(--text-muted)");
      chevron.setAttribute("stroke-width", "2.2");
      chevron.setAttribute("stroke-linecap", "round");
      chevron.setAttribute("stroke-linejoin", "round");
      chevron.setAttribute("class", "thinking-chevron" + (expanded ? " thinking-chevron--open" : ""));
      chevron.innerHTML = '<path d="M6 9l6 6 6-6"></path>';
      toggle.appendChild(chevron);

      toggle.addEventListener("click", () => {
            thinkingManualExpanded = !(thinkingManualExpanded ?? (autoExpanded || isFinished));
            renderThinkingPanel();
      });
      container.appendChild(toggle);

      // Body
      const body = document.createElement("div");
      body.className = "thinking-body" + (expanded ? " thinking-body--open" : "");
      body.style.maxHeight = expanded ? "2000px" : "0";

      const rail = document.createElement("div");
      rail.className = "stage-rail";
      const line = document.createElement("span");
      line.className = "stage-rail-line";
      line.style.height = "100%";
      rail.appendChild(line);

      const list = document.createElement("div");
      list.className = "stage-list";

      stages.forEach((stage, i) => {
            const isPast = i < reachedIndex || (i === reachedIndex && currentIsDoneEvent);
            const isCurrent = i === reachedIndex && !currentIsDoneEvent;
            const isErrorRow = failed && isCurrent;
            const message = isCurrent || isPast ? findLatestMessage(job.events, stage.id) : null;

            const row = document.createElement("div");
            row.className = "stage-row";
            row.style.animationDelay = `${i * 90}ms`;

            const iconWrap = document.createElement("span");
            iconWrap.className = "stage-icon";
            if (isErrorRow) {
                  iconWrap.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
            } else if (isPast) {
                  iconWrap.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--signal)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
            } else if (isCurrent) {
                  const dot = document.createElement("span");
                  dot.className = "stage-dot stage-dot--spin";
                  iconWrap.appendChild(dot);
            } else {
                  const dot = document.createElement("span");
                  dot.className = "stage-dot";
                  iconWrap.appendChild(dot);
            }
            row.appendChild(iconWrap);

            const label = document.createElement("span");
            label.className = "stage-label" + (isPast || isCurrent ? " stage-label--active" : "");
            label.textContent = stage.label;
            row.appendChild(label);

            if (message) {
                  const msgSpan = document.createElement("span");
                  msgSpan.className = "stage-message";
                  msgSpan.textContent = message;
                  row.appendChild(msgSpan);
            }

            list.appendChild(row);
      });

      rail.appendChild(list);
      body.appendChild(rail);
      container.appendChild(body);

      if (failed && job.error) {
            const err = document.createElement("p");
            err.className = "thinking-error";
            err.textContent = job.error;
            container.appendChild(err);
      }
}

/* ============================================================
   DOM helpers
   ============================================================ */
function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
}

/* ============================================================
   Report view (typecards — see report.css + report.js)
   ============================================================ */
function renderReport() {
      const root = $("report-root");
      root.innerHTML = "";
      if (job.phase !== "completed" || !job.report) return;
      if (!window.ReportViewer || typeof window.ReportViewer.render !== "function") {
            console.error("[report] ReportViewer failed to load");
            return;
      }
      try {
            root.appendChild(ReportViewer.render(job.report, { date: job.reportDate || null }));
      } catch (err) {
            console.error("[report] render failed", err);
      }
}

/* ============================================================
   Recording panel rendering
   ============================================================ */
function renderRecordingPanel() {
      const micBtn = $("mic-btn");
      const micIcon = $("mic-icon");
      const isRecording = recorder.status === "recording";

      micBtn.className = "mic-btn" + (isRecording ? " mic-btn--recording" : "");
      micBtn.disabled = recorder.status === "starting" || recorder.status === "stopping";
      micIcon.innerHTML = isRecording ? '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"></rect>' : '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>';

      $("mic-elapsed").textContent = formatElapsed(0, isRecording ? recorder.elapsedMs : 0);

      const bars = $("mic-bars");
      if (bars.childElementCount === 0) {
            for (let i = 0; i < 48; i++) bars.appendChild(el("div", "mic-bar"));
      }
      const barEls = bars.children;
      const center = 48 / 2;
      for (let i = 0; i < barEls.length; i++) {
            const distance = Math.abs(i - center) / center;
            const magnitude = isRecording ? Math.max(0.08, recorder.level * (1 - distance * 0.5)) : 0.04;
            barEls[i].className = "mic-bar" + (isRecording ? " mic-bar--active" : "");
            barEls[i].style.height = isRecording ? `${Math.max(10, magnitude * 100)}%` : "4px";
      }

      $("mic-status").textContent = recorder.status === "starting" ? "Starting…" : recorder.status === "stopping" ? "Saving recording…" : isRecording ? "Listening…" : "Click to start recording";

      $("discard-wrap").classList.toggle("hidden", !isRecording);

      const errorEl = $("recording-error");
      if (recorder.error) {
            errorEl.textContent = recorder.error;
            errorEl.classList.remove("hidden");
      } else {
            errorEl.classList.add("hidden");
      }

      renderAssistantState();
}

window.api.recording
      .getSources()
      .then((sources) => {
            const primary = sources[0];
            if (!primary) return;
            $("recording-source").classList.remove("hidden");
            if (primary.thumbnailDataUrl) $("recording-thumb").src = primary.thumbnailDataUrl;
            $("recording-source-name").textContent = primary.name;
      })
      .catch(() => {});

/* ============================================================
   Chat rendering + input wiring
   ============================================================ */
function renderChatMessages() {
      const container = $("chat-messages");
      container.innerHTML = "";
      if (chatMessages.length === 0) {
            container.appendChild(el("p", "mono-label", "Ask anything — the transcript is indexed and ready."));
            return;
      }
      chatMessages.forEach((m) => {
            const row = el("div", `chat-msg chat-msg--${m.role}`);
            const bubble = el("div", "chat-bubble" + (m.error ? " chat-bubble--error" : ""));
            if (m.error) {
                  bubble.textContent = m.error;
            } else {
                  bubble.textContent = m.content;
                  if (m.streaming) bubble.appendChild(el("span", "chat-caret"));
            }
            row.appendChild(bubble);
            container.appendChild(row);
      });
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
}

function renderChatInputState() {
      $("chat-input").disabled = chatIsStreaming;
      $("chat-submit").disabled = chatIsStreaming || !$("chat-input").value.trim();
      $("chat-disabled-hint").classList.toggle("hidden", !chatIsStreaming);
}

function renderChatUnlock() {
      const unlocked = job.phase === "completed" && job.jobId;
      chatSourceId = unlocked ? job.jobId : null;
      $("chat-locked").classList.toggle("hidden", !!unlocked);
      $("chat-panel").classList.toggle("hidden", !unlocked);
      if (unlocked) {
            const isMeeting = job.report && "executive_summary" in job.report;
            $("chat-title").textContent = isMeeting ? "This meeting" : "This video";
      }
}

$("chat-input").addEventListener("input", renderChatInputState);
$("chat-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitChat();
      }
});
$("chat-submit").addEventListener("click", submitChat);

function submitChat() {
      const input = $("chat-input");
      const value = input.value.trim();
      if (!value || chatIsStreaming) return;
      input.value = "";
      renderChatInputState();
      void chatAsk(value);
}

/* ============================================================
   URL input wiring
   ============================================================ */
$("url-input").addEventListener("input", () => {
      $("url-submit").disabled = backendState.status !== "ready" || !$("url-input").value.trim();
});
$("url-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitUrl();
      }
});
$("url-submit").addEventListener("click", submitUrl);

function submitUrl() {
      const input = $("url-input");
      const value = input.value.trim();
      if (!value || backendState.status !== "ready") return;
      input.value = "";
      void startYoutubeJob(value);
      renderAll();
}

/* ============================================================
   Mic / recording wiring
   ============================================================ */
$("mic-btn").addEventListener("click", async () => {
      if (recorder.status === "recording") {
            const saved = await recorderStop();
            if (saved) void startMeetingJob(saved.path);
            renderAll();
      } else {
            await recorderStart();
      }
});
$("discard-btn").addEventListener("click", () => recorderDiscard());

/* ============================================================
   New / reset button
   ============================================================ */
$("new-btn").addEventListener("click", () => {
      resetJob();
      recorderDiscard();
      chatMessages = [];
      renderAll();
});

/* ============================================================
   Title bar window controls
   ============================================================ */
const isMac = navigator.userAgent.includes("Mac");
if (isMac) {
      $("window-controls").classList.add("hidden");
      document.querySelector(".titlebar-left").style.paddingLeft = "64px";
} else {
      $("win-minimize").addEventListener("click", () => window.api.window.minimize());
      $("win-maximize").addEventListener("click", () => window.api.window.maximizeToggle());
      $("win-close").addEventListener("click", () => window.api.window.close());
}

/* ============================================================
   Saved Reports Viewer
   Components: SavedReportsList, ReportCard, ReportViewer
   ============================================================ */
const SAVED_REPORTS_KEY = "saved_reports";
const CARD_VARIANTS = ["stripe", "wise", "paypal"];

let savedReports = [];
let savedReportsLoading = false;
let savedReportsFetched = false;

function readCachedReports() {
      try {
            const raw = localStorage.getItem(SAVED_REPORTS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
      } catch {
            return [];
      }
}

function writeCachedReports(reports) {
      try {
            localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(reports));
      } catch {
            /* quota / private mode — ignore */
      }
}

function shortId(id) {
      if (!id) return "----";
      const clean = String(id).replace(/-/g, "");
      return clean.slice(0, 4) + " " + clean.slice(-4);
}

function chunkReports(reports, size) {
      const groups = [];
      for (let i = 0; i < reports.length; i += size) groups.push(reports.slice(i, i + size));
      return groups;
}

/** ReportCard — one wallet card for a saved report */
function ReportCard(report, variant, animationDelay) {
      const card = el("div", `rw-card ${variant}`);
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.dataset.reportId = report.id;
      card.title = report.name;
      if (animationDelay) card.style.animationDelay = animationDelay;

      const inner = el("div", "card-inner");

      const top = el("div", "card-top");
      top.appendChild(el("span", null, report.name));
      top.appendChild(el("div", "chip"));
      inner.appendChild(top);

      const bottom = el("div", "card-bottom");
      const info = el("div", "card-info");
      info.appendChild(el("span", "label", report.report_type === "meeting" ? "Meeting" : "YouTube"));
      info.appendChild(el("span", "value", report.date || "—"));
      bottom.appendChild(info);

      const numberWrap = el("div", "card-number-wrapper");
      numberWrap.appendChild(el("span", "hidden-stars", "**** " + shortId(report.id).split(" ").pop()));
      numberWrap.appendChild(el("span", "card-number", report.summary || shortId(report.id)));
      bottom.appendChild(numberWrap);

      inner.appendChild(bottom);
      card.appendChild(inner);

      const open = (e) => {
            e.stopPropagation();
            void openSavedReport(report.id);
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(e);
            }
      });

      return card;
}

function buildPocket(count) {
      const pocket = el("div", "pocket");
      pocket.innerHTML = `
            <svg class="pocket-svg" viewBox="0 0 280 160" fill="none" aria-hidden="true">
                  <path d="M 0 20 C 0 10, 5 10, 10 10 C 20 10, 25 25, 40 25 L 240 25 C 255 25, 260 10, 270 10 C 275 10, 280 10, 280 20 L 280 120 C 280 155, 260 160, 240 160 L 40 160 C 20 160, 0 155, 0 120 Z" fill="#1e341e"></path>
                  <path d="M 8 22 C 8 16, 12 16, 15 16 C 23 16, 27 29, 40 29 L 240 29 C 253 29, 257 16, 265 16 C 268 16, 272 16, 272 22 L 272 120 C 272 150, 255 152, 240 152 L 40 152 C 25 152, 8 152, 8 120 Z" stroke="#3d5635" stroke-width="1.5" stroke-dasharray="6 4"></path>
            </svg>
            <div class="pocket-content">
                  <div style="position: relative; height: 22px; width: 100%;">
                        <div class="balance-stars">******</div>
                        <div class="balance-real">${count} report${count === 1 ? "" : "s"}</div>
                  </div>
                  <div class="pocket-label">Saved Reports</div>
                  <div class="eye-icon-wrapper">
                        <svg class="eye-icon eye-slash" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                              <line x1="3" y1="3" x2="21" y2="21"></line>
                        </svg>
                        <svg class="eye-icon eye-open" style="opacity: 0;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                  </div>
            </div>
      `;
      return pocket;
}

/** One wallet holding up to 3 ReportCards */
function ReportsWallet(group) {
      const wallet = el("div", "reports-wallet");
      wallet.appendChild(el("div", "wallet-back"));

      // Stack order: first report sits deepest (top of stack visually when fanned)
      group.forEach((report, index) => {
            const variant = CARD_VARIANTS[index] || CARD_VARIANTS[CARD_VARIANTS.length - 1];
            wallet.appendChild(ReportCard(report, variant, `${0.1 + index * 0.1}s`));
      });

      wallet.appendChild(buildPocket(group.length));
      return wallet;
}

/** SavedReportsList — fetch + render wallet grid on the idle screen */
function SavedReportsList() {
      const section = $("saved-reports");
      const list = $("saved-reports-list");
      const empty = $("saved-reports-empty");

      const show = job.phase === "idle";
      section.classList.toggle("hidden", !show);
      if (!show) return;

      list.innerHTML = "";

      if (!savedReports.length) {
            empty.classList.remove("hidden");
            empty.textContent = savedReportsLoading ? "Loading saved reports…" : "No saved reports yet";
            return;
      }

      empty.classList.add("hidden");
      chunkReports(savedReports, 3).forEach((group) => list.appendChild(ReportsWallet(group)));
}

/** ReportViewer — open a saved report in the main report pane */
async function openSavedReport(reportId) {
      if (!reportId || backendState.status !== "ready") return;
      try {
            const detail = await window.api.reports.get(reportId);
            resetJob();
            chatMessages = [];
            setJob({
                  phase: "completed",
                  jobId: detail.id,
                  jobType: detail.report_type,
                  report: detail.content,
                  reportDate: detail.date,
                  currentStage: "finished",
                  events: [],
                  error: null,
            });
            document.querySelector(".main-content")?.scrollTo?.({ top: 0, behavior: "smooth" });
      } catch (err) {
            console.error("[saved-reports] failed to open", err);
      }
}

async function refreshSavedReports() {
      if (backendState.status !== "ready") {
            savedReports = readCachedReports();
            SavedReportsList();
            return;
      }

      savedReportsLoading = true;
      SavedReportsList();
      try {
            const reports = await window.api.reports.list();
            savedReports = reports;
            savedReportsFetched = true;
            writeCachedReports(reports);
      } catch (err) {
            console.error("[saved-reports] list failed", err);
            if (!savedReportsFetched) savedReports = readCachedReports();
      } finally {
            savedReportsLoading = false;
            SavedReportsList();
      }
}

function renderIdleCards() {
      const showUrl = job.phase === "idle" && mode === "youtube";
      const showRecording = job.phase === "idle" && mode === "meeting";
      $("url-card").classList.toggle("hidden", !showUrl);
      $("recording-card").classList.toggle("hidden", !showRecording);
      if (showUrl) $("url-submit").disabled = backendState.status !== "ready" || !$("url-input").value.trim();
      SavedReportsList();
}

/* ============================================================
   Root render
   ============================================================ */
function renderAll() {
      const jobRunning = job.phase === "creating" || job.phase === "running";
      setModeSwitcherDisabled(jobRunning || recorder.status === "recording");
      $("new-btn").classList.toggle("hidden", job.phase === "idle");
      $("new-btn").textContent = `New ${mode === "youtube" ? "video" : "meeting"}`;

      renderIdleCards();
      renderThinkingPanel();
      renderReport();
      renderRecordingPanel();
      renderChatUnlock();
      renderAssistantState();
}

renderBackendStatus();
renderAll();
savedReports = readCachedReports();
SavedReportsList();

// On cold start and after Ctrl+R, the main process may already be "ready"
// with no further status events. Pull current status explicitly.
if (typeof window.api.backend.getStatus === "function") {
      window.api.backend
            .getStatus()
            .then(applyBackendStatus)
            .catch((err) => {
                  console.error("[backend] getStatus failed", err);
            });
} else if (backendState.status === "ready") {
      void refreshSavedReports();
}
