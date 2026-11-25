# DocuMind

**AI-Powered Document Intelligence and Learning Platform**

DocuMind turns PDFs and Word documents into structured study material: document analysis, topic and keyword extraction, rich summaries, Ask-AI chat, MCQ generation, descriptive questions, answer evaluation, and quiz history.

## Main features

- Document upload and processing for PDF/DOCX
- Page-aware text extraction and chunking
- AI document analysis: overview, executive summary, key points, definitions, concepts, keywords, and ranked topics
- Structured summaries: short, detailed, section-wise, chapter summaries, key findings, and takeaways
- Ask AI chat grounded in the uploaded document
- MCQ generation with topic, difficulty, count, page references, explanations, and validation
- Descriptive question generation with expected answers, key points, subtype, and difficulty
- Descriptive answer evaluation with feedback, covered/missing points, and suggestions
- Quiz generation, attempts, scoring, and history review
- Lecture ingestion support for video/audio/YouTube workflows
- Optional Python AI microservice for transcription, OCR/frame extraction, document parsing, and ChromaDB vector storage

## Technology stack

| Layer | Stack |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Radix UI, Zustand, Axios |
| Backend API | Node.js, Express, MongoDB/Mongoose, JWT auth, BullMQ/Redis optional queue |
| AI/LLM | Google Gemini with Groq fallback; provider/model fallback chain |
| AI microservice | Python, FastAPI, faster-whisper, OpenCV/Tesseract OCR, ChromaDB |
| Storage | Local uploads or Cloudinary; MongoDB for app data |

## Project architecture

```text
DocuMind/
├── app/                         # Next.js frontend routes and pages
├── components/                  # Shared UI components
├── hooks/                       # React hooks
├── lib/                         # API client, types, utilities, store
├── public/                      # Static assets
├── styles/                      # Global/style assets
├── services/
│   ├── backend/                 # Express API, MongoDB models, workers, tests
│   │   └── src/
│   │       ├── config/
│   │       ├── controllers/
│   │       ├── middlewares/
│   │       ├── models/
│   │       ├── queues/
│   │       ├── routes/
│   │       ├── services/
│   │       └── ai_models/       # Python AI modules used by parser/worker fallbacks
│   └── python-ai/               # FastAPI AI microservice
├── package.json                 # Frontend package and root scripts
├── README.md
└── configuration files
```

The frontend intentionally remains at the repository root because this is a Next.js application. Backend and Python AI services live under `services/` to keep the working architecture stable.

## Frontend setup

```bash
cd DocuMind
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Run development server:

```bash
npm run dev
```

Build and start production frontend:

```bash
npm run build
npm run start
```

## Backend setup

```bash
cd services/backend
npm install
node src/server.js
```

Create `.env` from `.env.example` and configure at minimum:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
JWT_SECRET=replace_with_strong_secret
MONGO_URI=mongodb://127.0.0.1:27017/smartlecture
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

Optional backend variables:

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
STORAGE_LOCAL_PATH=./uploads
PYTHON_AI_URL=http://localhost:8000
TRANSCRIBE_SERVICE_URL=http://localhost:8000/transcribe
EXTRACT_SERVICE_URL=http://localhost:8000/extract
QUIZ_SERVICE_URL=http://localhost:8000/quiz
SUMMARIZE_SERVICE_URL=http://localhost:8000/summarize
CLEAN_SERVICE_URL=http://localhost:8000/clean
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
MAX_QUESTIONS_PER_GENERATION=20
```

Run the BullMQ worker in a separate terminal when Redis queue processing is enabled:

```bash
cd services/backend
node src/worker.js
```

## AI microservice setup

The Python AI service is optional for document-only workflows, but recommended for transcription, OCR/frame extraction, parsing, and vector storage.

```bash
cd services/python-ai
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

It runs on `http://localhost:8000` by default.

## Commands to run all services

Terminal 1 — backend API:

```bash
cd services/backend
node src/server.js
```

Terminal 2 — worker, if using Redis/BullMQ:

```bash
cd services/backend
node src/worker.js
```

Terminal 3 — Python AI service, if needed:

```bash
cd services/python-ai
python main.py
```

Terminal 4 — frontend:

```bash
cd DocuMind
npm run dev
```

## API overview

Backend API base: `http://localhost:5000/api`

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/documents`, `GET /api/documents/:id`, document analysis/summary/chat/question endpoints
- `POST /api/quizzes/generate`, `GET /api/quizzes`, `GET /api/quizzes/:id`, `POST /api/quizzes/:id/attempt`, `GET /api/quizzes/history`
- `GET/POST /api/lectures`, lecture processing endpoints
- `GET /api/analytics/...`

Python AI service base: `http://localhost:8000`

- `GET /health`
- `POST /transcribe`
- `POST /extract`
- `POST /quiz`
- `POST /clean`
- `POST /summarize`
- `POST /ingest-text`
- `POST /query-document`
- `POST /ingest-document`
- `POST /parse-document`
- `DELETE /delete-document/{document_id}`

## Validation commands

Frontend typecheck:

```bash
npx tsc --noEmit
```

Backend tests:

```bash
npm test
# or
npm --prefix services/backend test
```

Backend syntax check:

```bash
node --check services/backend/src/server.js
```

## Notes

- Keep real secrets in `.env` / `.env.local` or your deployment secret manager, not in `.env.example`.
- Do not commit `node_modules`, `.next`, uploads, `chroma_db`, virtual environments, or build artifacts.
- Existing API endpoint paths are intentionally stable; only project naming and folder references were updated.
