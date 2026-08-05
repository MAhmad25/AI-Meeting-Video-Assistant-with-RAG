import path from "node:path";
import { app } from "electron";

/** Loopback-only — the FastAPI server never needs to be reachable off-device. */
export const BACKEND_HOST = "127.0.0.1";
export const BACKEND_PORT = 8756;
export const BACKEND_BASE_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

export const IS_DEV = process.env.NODE_ENV ? process.env.NODE_ENV === "development" : !app.isPackaged;

/** Root of the Python backend project (contains pyproject.toml, app/, storage/). */
export function backendProjectRoot(): string {
  if (!app.isPackaged) {
    // desktop/ and backend/ are sibling folders in the repo. This covers
    // both `npm run dev` and `npm start` — both run unpackaged via
    // `electron .`, regardless of NODE_ENV, so this must key off
    // app.isPackaged rather than IS_DEV (which tracks NODE_ENV for the
    // separate concern of which renderer source to load).
    return path.resolve(__dirname, "..", "..", "..", "backend");
  }
  // Packaged: electron-builder copies ../backend to resources/backend (see
  // package.json > build.extraResources).
  return path.join(process.resourcesPath, "backend");
}

export const BACKEND_HEALTH_PATH = "/health";
export const BACKEND_STARTUP_TIMEOUT_MS = 30_000;
export const BACKEND_HEALTH_POLL_INTERVAL_MS = 500;

export const APP_NAME = "AI Meeting Assistant";
