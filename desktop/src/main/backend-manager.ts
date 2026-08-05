import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import log from "electron-log/main";
import type { BackendStatus, BackendStatusEvent } from "@shared/types";
import {
  BACKEND_BASE_URL,
  BACKEND_HEALTH_PATH,
  BACKEND_HEALTH_POLL_INTERVAL_MS,
  BACKEND_HOST,
  BACKEND_PORT,
  BACKEND_STARTUP_TIMEOUT_MS,
  IS_DEV,
  backendProjectRoot,
} from "./constants";

type StatusListener = (event: BackendStatusEvent) => void;

/**
 * Resolves which python interpreter to launch uvicorn with, preferring a
 * project-local virtualenv (created via `uv sync` / `python -m venv .venv`
 * per backend/README.md) so the packaged app doesn't depend on whatever
 * `python` happens to resolve to on the user's PATH.
 */
function resolvePythonExecutable(root: string): string {
  const isWin = process.platform === "win32";
  const venvBin = isWin
    ? path.join(root, ".venv", "Scripts", "python.exe")
    : path.join(root, ".venv", "bin", "python");

  if (fs.existsSync(venvBin)) return venvBin;

  return isWin ? "python" : "python3";
}

export class BackendManager {
  private process: ChildProcessWithoutNullStreams | null = null;
  private listeners = new Set<StatusListener>();
  private status: BackendStatus = "stopped";
  private shuttingDown = false;

  onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getStatus(): BackendStatus {
    return this.status;
  }

  getBaseUrl(): string {
    return BACKEND_BASE_URL;
  }

  private emit(status: BackendStatus, message?: string) {
    this.status = status;
    const event: BackendStatusEvent = { status, message, baseUrl: BACKEND_BASE_URL };
    for (const listener of this.listeners) listener(event);
  }

  async start(): Promise<void> {
    if (this.process) {
      log.warn("[backend] start() called while a backend process is already running");
      return;
    }

    const root = backendProjectRoot();
    const python = resolvePythonExecutable(root);

    log.info(`[backend] launching uvicorn via "${python}" in ${root}`);
    this.emit("starting", "Launching local AI backend…");

    const child = spawn(
      python,
      [
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        BACKEND_HOST,
        "--port",
        String(BACKEND_PORT),
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          // Dev-mode CORS origin matches app/core/config.py::settings.cors_origins.
          ENVIRONMENT: IS_DEV ? "development" : "production",
        },
      }
    ) as ChildProcessWithoutNullStreams;

    this.process = child;

    child.stdout.on("data", (chunk: Buffer) => log.info(`[uvicorn] ${chunk.toString().trim()}`));
    child.stderr.on("data", (chunk: Buffer) => log.info(`[uvicorn:err] ${chunk.toString().trim()}`));

    child.on("exit", (code, signal) => {
      this.process = null;
      if (this.shuttingDown) {
        this.emit("stopped", "Backend stopped");
        return;
      }
      log.error(`[backend] uvicorn exited unexpectedly (code=${code}, signal=${signal})`);
      this.emit("crashed", `Backend process exited (code ${code ?? signal ?? "unknown"})`);
    });

    child.on("error", (err) => {
      log.error("[backend] failed to spawn python process", err);
      this.emit(
        "crashed",
        `Could not start the Python backend: ${err.message}. Make sure Python 3 is installed and the backend virtualenv is set up (see backend/README.md).`
      );
    });

    await this.waitForHealthy();
  }

  private waitForHealthy(): Promise<void> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + BACKEND_STARTUP_TIMEOUT_MS;

      const poll = () => {
        if (!this.process) {
          // Process already died — don't keep polling a dead child.
          return reject(new Error("Backend process exited before becoming healthy"));
        }

        const req = http.get(
          { host: BACKEND_HOST, port: BACKEND_PORT, path: BACKEND_HEALTH_PATH, timeout: 2000 },
          (res) => {
            res.resume();
            if (res.statusCode === 200) {
              this.emit("ready", "Backend ready");
              resolve();
            } else {
              retry();
            }
          }
        );
        req.on("error", retry);
        req.on("timeout", () => {
          req.destroy();
          retry();
        });
      };

      const retry = () => {
        if (Date.now() > deadline) {
          this.emit("unreachable", "Timed out waiting for the backend to start");
          reject(new Error("Timed out waiting for backend health check"));
          return;
        }
        setTimeout(poll, BACKEND_HEALTH_POLL_INTERVAL_MS);
      };

      poll();
    });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    this.shuttingDown = true;
    const child = this.process;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        log.warn("[backend] graceful shutdown timed out, force killing");
        child.kill("SIGKILL");
      }, 5000);

      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });

      // SIGTERM lets uvicorn's own lifespan shutdown hooks run.
      child.kill(process.platform === "win32" ? undefined : "SIGTERM");
      if (process.platform === "win32") {
        // Windows has no SIGTERM; ask the child to exit via its stdin close,
        // then fall back to taskkill for the process tree.
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
      }
    });

    this.process = null;
    this.shuttingDown = false;
  }
}

export const backendManager = new BackendManager();
