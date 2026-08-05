# Report Generation Application

A desktop **report generation** app that turns meeting audio and YouTube content into structured AI reports — powered by a **FastAPI** backend, an **Electron** frontend, and **local LLMs via Ollama**. Everything can run offline: models stay on your machine, and reports are saved locally.

<img src="https://i.ibb.co/qY59st4z/Screenshot-2026-08-06-001037.png" alt="Screenshot 2026 08 06 001037" border="0" width="100%">

<img src="https://i.ibb.co/qMzWcdD9/Screenshot-2026-08-06-003022.png" alt="Screenshot 2026 08 06 003022" border="0">

<img src="https://i.ibb.co/BH7Sk3t6/Screenshot-2026-08-06-001127.png" alt="Screenshot 2026 08 06 001127" border="0" width="100%">
---

## Features

- **LLM-powered report generation** — map/reduce pipelines produce structured reports from transcripts and media
- **RAG-enabled retrieval** — local embeddings and vector search let the desktop app answer questions from meeting transcripts, YouTube content, and saved reports with retrieval-augmented generation
- **Local report storage** — generated reports are saved under `backend/storage/reports`
- **Report viewer UI** — card-based layout in the Electron renderer for browsing and reading reports
- **FastAPI backend** — REST API for jobs, meetings, YouTube, chat, and reports
- **Electron desktop interface** — native-feeling desktop shell with HTML/CSS/JS UI
- **Offline-capable** — inference through Ollama (no cloud API required for local models)

---

## Tech Stack

| Layer      | Technology                            |
| ---------- | ------------------------------------- |
| Desktop UI | Electron.js, HTML, CSS, JavaScript    |
| Backend    | FastAPI, Python, Uvicorn              |
| AI / LLM   | Ollama (e.g. `qwen2.5:3b`), LangChain |
| Storage    | Local filesystem (`storage/reports`)  |

---

## Environment Setup

| Requirement | Notes                                            |
| ----------- | ------------------------------------------------ |
| **Python**  | 3.11+ recommended (see `backend/pyproject.toml`) |
| **Node.js** | 18+ (LTS recommended)                            |
| **Ollama**  | Required for local LLM and embeddings            |
| **FFmpeg**  | Required for audio / YouTube processing          |

---

## Using Ollama (Local Models)

This project is designed to use **free, local models** through [Ollama](https://ollama.com). No API keys or cloud billing are required for local inference.

### 1. Install Ollama

Download and install from [https://ollama.com](https://ollama.com), then ensure the service is running (`ollama serve` if needed).

### 2. Pull a model

```bash
ollama pull qwen2.5:3b
```

For embeddings / RAG chat support used by the backend:

```bash
ollama pull nomic-embed-text
```

### 3. Run the model (optional smoke test)

```bash
ollama run qwen2.5:3b
```

### 4. OpenAI-compatible API

Ollama exposes an OpenAI-compatible endpoint at:

```
http://localhost:11434/v1
```

### 5. Example integration (LangChain)

In `backend/app/core/llm.py`, point `ChatOpenAI` at Ollama:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="qwen2.5:3b",
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)
```

**Why this matters**

- **No API cost** — models run on your hardware
- **Fully local inference** — data does not leave your machine for LLM calls
- Works **without internet** once models are pulled

---

## How to Run the Project

### Backend (FastAPI)

```bash
cd backend

# Create and activate a virtual environment (recommended)
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

# Install dependencies (uv or pip)
pip install -e .

# Run the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs (when running): [http://localhost:8000/docs](http://localhost:8000/docs)

Optional: create `backend/.env` for any cloud keys you still want to use; Ollama itself does not need an API key.

### Frontend (Electron)

```bash
cd desktop

# Install Node modules
npm install

# Development (TypeScript watch + Electron)
npm run dev

# Or production-style start (build then launch)
npm start
```

Ensure the FastAPI backend is running before using report generation features from the desktop app.

---

## Project Structure

```
.
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── chains/          # LangChain map/reduce & report chains
│   │   ├── core/            # Config, LLM, embeddings, vector store
│   │   ├── pipelines/       # Meeting / YouTube processing pipelines
│   │   ├── prompts/         # Prompt templates
│   │   ├── routers/         # API routes (reports, jobs, chat, …)
│   │   ├── schemas/         # Pydantic models
│   │   ├── services/        # Whisper, YouTube, report writer, etc.
│   │   └── main.py          # FastAPI entrypoint
│   ├── storage/
│   │   ├── reports/         # Saved reports (local)
│   │   ├── recordings/      # Meeting recordings
│   │   └── …                # Downloads, processed audio, etc.
│   └── pyproject.toml
├── desktop/                 # Electron desktop app
│   ├── src/                 # Main / preload TypeScript
│   ├── renderer-vanilla/    # HTML / CSS / JS UI (incl. report viewer)
│   ├── dist/                # Compiled Electron output
│   └── package.json
└── README.md
```

| Path                        | Role                                   |
| --------------------------- | -------------------------------------- |
| `/backend`                  | FastAPI API and AI pipelines           |
| `/desktop`                  | Electron frontend (desktop shell + UI) |
| `/backend/storage/reports`  | Locally saved reports                  |
| `/desktop/renderer-vanilla` | Report viewer and app UI assets        |

---

## Important Notes

- **Reports are stored locally** in `backend/storage/reports` — they are not uploaded to a remote service by default.
- **Models run locally** via Ollama when configured with `base_url=http://localhost:11434/v1`.
- **No cloud dependency is required** for core offline LLM workflows once Ollama and models are installed.
- Keep Ollama running while generating reports or using chat/RAG features that need embeddings.

---

## License

ISC
